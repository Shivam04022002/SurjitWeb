const EmailSetting = require('../../models/EmailSetting');
const { encrypt, decrypt } = require('../../utils/secretBox');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const logger = require('../../utils/logger');
const graph = require('./microsoftGraph');
const rules = require('./emailRules');

// Email Settings: the one place the configuration is read, written and tested.
//
// The client secret is decrypted only inside this module, and only to be
// handed to the Microsoft client. Every value returned to a controller comes
// from publicStatus(), which carries the secret's last four characters at most.

const { SINGLETON_KEY } = EmailSetting;

const hintOf = (secret) => (secret ? secret.slice(-4) : '');

const load = (withSecret = false) => {
    const q = EmailSetting.findOne({ key: SINGLETON_KEY });
    return withSecret ? q.select('+encryptedClientSecret') : q;
};

// What is missing before mail can be sent, in words the page can show.
const missingParts = (doc, secretReadable) => {
    if (!doc) return ['Email settings have not been saved'];
    const missing = [];
    if (!rules.isSupported(doc.provider, doc.authMethod)) missing.push(rules.unsupportedMessage(doc.provider, doc.authMethod));
    if (!doc.tenantId) missing.push('Directory (tenant) ID');
    if (!doc.clientId) missing.push('Application (client) ID');
    if (!doc.encryptedClientSecret) missing.push('Client secret');
    else if (!secretReadable) missing.push('The saved client secret can no longer be read — enter it again');
    return missing;
};

const publicStatus = async () => {
    const doc = await load(true);
    const secretReadable = !!(doc?.encryptedClientSecret && decrypt(doc.encryptedClientSecret));
    const missing = missingParts(doc, secretReadable);
    return {
        saved: !!doc,
        configured: missing.length === 0,
        missing,
        supported: rules.SUPPORTED,
        settings: doc ? {
            provider: doc.provider,
            authMethod: doc.authMethod,
            senderName: doc.senderName,
            senderEmail: doc.senderEmail,
            tenantId: doc.tenantId,
            clientId: doc.clientId,
            primaryRecipient: doc.primaryRecipient,
            additionalRecipients: doc.additionalRecipients,
            notifyNewLoanApplication: doc.notifyNewLoanApplication
        } : null,
        clientSecret: {
            configured: !!doc?.encryptedClientSecret,
            readable: secretReadable,
            hint: doc?.encryptedClientSecret ? doc.clientSecretHint : ''
        },
        lastTest: doc?.lastTest?.at ? doc.lastTest : null,
        updatedAt: doc?.updatedAt || null
    };
};

const fieldError = (field, message) => new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [{ field, message }]);

// Saves the validated configuration. A blank client secret keeps the one
// already stored — the page never has it to send back — so a secret is only
// ever replaced by a new one, never cleared by an empty field.
const save = async (input, userId) => {
    const existing = await load(true);
    const newSecret = typeof input.clientSecret === 'string' ? input.clientSecret.trim() : '';
    const storedReadable = !!(existing?.encryptedClientSecret && decrypt(existing.encryptedClientSecret));

    if (!newSecret && !storedReadable) {
        throw fieldError('clientSecret', existing?.encryptedClientSecret
            ? 'The saved client secret can no longer be read. Enter it again.'
            : 'Enter the client secret');
    }

    const settings = {
        provider: input.provider,
        authMethod: input.authMethod,
        senderName: String(input.senderName || '').trim(),
        senderEmail: rules.normaliseEmail(input.senderEmail),
        tenantId: String(input.tenantId).trim(),
        clientId: String(input.clientId).trim().toLowerCase(),
        primaryRecipient: rules.normaliseEmail(input.primaryRecipient),
        additionalRecipients: (input.additionalRecipients || []).map(rules.normaliseEmail),
        notifyNewLoanApplication: input.notifyNewLoanApplication !== false
    };

    // A previous test proved a connection that may no longer be the one in
    // use, so it is cleared whenever anything it depended on changes.
    const connectionChanged = !existing || !!newSecret
        || ['provider', 'authMethod', 'senderEmail', 'tenantId', 'clientId'].some((k) => existing[k] !== settings[k]);

    const $set = { ...settings, updatedBy: userId || null };
    if (newSecret) {
        $set.encryptedClientSecret = encrypt(newSecret);
        $set.clientSecretHint = hintOf(newSecret);
    }
    if (connectionChanged) $set.lastTest = { at: null, kind: null, ok: null, code: '', message: '' };

    await EmailSetting.findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set, $setOnInsert: { key: SINGLETON_KEY } },
        { upsert: true, runValidators: true }
    );
    if (connectionChanged) graph.clearTokenCache();

    logger.info('Email settings updated', { by: String(userId || ''), secretReplaced: !!newSecret });
    return publicStatus();
};

// The saved configuration, ready for the Microsoft client — or the reason it
// is not. Shared by both tests, and by the loan-application emails later.
const resolveSending = async () => {
    const doc = await load(true);
    const secret = doc?.encryptedClientSecret ? decrypt(doc.encryptedClientSecret) : null;
    const missing = missingParts(doc, !!secret);
    if (missing.length) {
        throw new graph.MicrosoftError('NOT_CONFIGURED', `Email is not configured: ${missing.join('; ')}.`);
    }
    return {
        doc,
        credentials: { tenantId: doc.tenantId, clientId: doc.clientId, clientSecret: secret }
    };
};

const recordTest = async (kind, result) => {
    await EmailSetting.updateOne(
        { key: SINGLETON_KEY },
        { $set: { lastTest: { at: result.testedAt, kind, ok: result.ok, code: result.code, message: result.message.slice(0, 500) } } }
    );
};

// Errors from here reach the page. A MicrosoftError's message is written by
// this application and names no credential; anything else is reported
// generically and logged by its type only.
const failure = (err) => {
    if (err instanceof graph.MicrosoftError) return { code: err.code, message: err.message, retryAfter: err.retryAfter };
    logger.error('Email test failed unexpectedly', { name: err?.name });
    return { code: 'UNEXPECTED', message: 'The test could not be completed. Try again, and check the server log if it keeps failing.' };
};

// Signs in to Microsoft with a fresh token and checks that the app holds the
// Mail.Send application permission. Whether the sender mailbox accepts the app
// can only be shown by sending — that is Send Test Email.
const testConnection = async () => {
    let result;
    try {
        const { credentials } = await resolveSending();
        const token = await graph.getAccessToken(credentials, { fresh: true });
        if (!graph.hasMailSend(token)) {
            result = {
                ok: false,
                code: 'MISSING_PERMISSION',
                message: `Signed in to Microsoft, but the app does not hold the ${graph.REQUIRED_ROLE} application permission. Add it under API permissions and grant admin consent.`
            };
        } else {
            result = {
                ok: true,
                code: 'CONNECTED',
                message: `Connected. Microsoft accepted the app credentials and the app holds ${graph.REQUIRED_ROLE}. Send a test email to confirm the sender mailbox.`
            };
        }
    } catch (err) {
        result = { ok: false, ...failure(err) };
    }
    result.testedAt = new Date();

    // A test of a configuration that was never saved has nowhere to be recorded.
    if (result.code !== 'NOT_CONFIGURED') await recordTest('connection', result);
    if (!result.ok) logger.warn('Email connection test failed', { code: result.code });
    return result;
};

const TEST_SUBJECT = 'Surjit Finance CMS test email';

// The message is fixed: only the recipient comes from the request, so this
// endpoint cannot be used to send anything but this notice.
const testMessageText = ({ actor, sender, sentAt }) => [
    'This is a test email from the Email Settings page of the Surjit Finance CMS.',
    '',
    `Sent from: ${sender}`,
    `Requested by: ${actor?.name || 'a CMS administrator'}${actor?.email ? ` (${actor.email})` : ''}`,
    `Time: ${sentAt.toISOString()}`,
    '',
    'If you received this, the CMS can send email through Microsoft 365. No action is needed.'
].join('\n');

const sendTestEmail = async (recipient, actor) => {
    const to = rules.normaliseEmail(recipient);
    const sentAt = new Date();
    let result;
    try {
        const { doc, credentials } = await resolveSending();
        await graph.sendMail(credentials, {
            sender: doc.senderEmail,
            senderName: doc.senderName,
            to: [to],
            subject: TEST_SUBJECT,
            text: testMessageText({ actor, sender: doc.senderEmail, sentAt })
        });
        result = {
            ok: true,
            code: 'SENT',
            message: `Microsoft accepted the test email to ${to} for delivery. Check that inbox (and its junk folder).`
        };
    } catch (err) {
        result = { ok: false, ...failure(err) };
    }
    result.testedAt = sentAt;

    if (result.code !== 'NOT_CONFIGURED') await recordTest('email', result);
    if (!result.ok) logger.warn('Test email failed', { code: result.code });
    else logger.info('Test email sent', { by: String(actor?._id || '') });
    return result;
};

module.exports = { publicStatus, save, testConnection, sendTestEmail, resolveSending, TEST_SUBJECT };
