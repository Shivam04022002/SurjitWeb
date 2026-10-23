const EmailSetting = require('../../models/EmailSetting');
const Product = require('../../models/Product');
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

// The configuration has two halves, kept in the one document:
//
//   provider    the Microsoft 365 app credentials and sender mailbox, set in
//               the Email API card on the API page. Enough to sign in and send
//               a test email.
//   recipients  who is told about new loan applications, and whether to tell
//               them, set on Email Settings. Needed for those emails only.
const PROVIDER_FIELDS = ['provider', 'authMethod', 'senderName', 'senderEmail', 'tenantId', 'clientId'];
const RECIPIENT_FIELDS = ['primaryRecipient', 'additionalRecipients', 'notifyNewLoanApplication', 'recipientProducts'];
// What a previous test proved depends on these; changing one clears it.
const CONNECTION_FIELDS = ['provider', 'authMethod', 'senderEmail', 'tenantId', 'clientId'];

// What is missing before mail can be sent at all, in words the page can show.
const providerMissing = (doc, secretReadable) => {
    if (!doc) return ['The email provider has not been set up in the API section'];
    const missing = [];
    if (!rules.isSupported(doc.provider, doc.authMethod)) missing.push(rules.unsupportedMessage(doc.provider, doc.authMethod));
    if (!doc.tenantId) missing.push('Directory (tenant) ID');
    if (!doc.clientId) missing.push('Application (client) ID');
    if (!doc.encryptedClientSecret) missing.push('Client secret');
    else if (!secretReadable) missing.push('The saved client secret can no longer be read — enter it again');
    if (!doc.senderEmail) missing.push('Sender mailbox');
    return missing;
};

// What is missing before loan-application emails have anyone to go to.
const recipientsMissing = (doc) => (doc?.primaryRecipient ? [] : ['Primary notification recipient']);

// Each additional recipient's product assignment as the page shows it, with
// every assigned product's name, category and whether it is active, from the
// catalogue as it is now. A product deleted since it was assigned is listed by
// id alone. `legacy`: added before assignments existed, so emailed about every
// application until products are assigned.
const recipientProductsView = async (doc) => {
    const additional = doc?.additionalRecipients || [];
    const assignments = additional.map((email) => ({ email, ...rules.assignmentFor(doc, email) }));
    const ids = [...new Set(assignments.flatMap((a) => a.productIds))];
    const found = ids.length
        ? await Product.find({ _id: { $in: ids } }).select('name isActive category').populate('category', 'name').lean()
        : [];
    const byId = new Map(found.map((p) => [String(p._id), p]));
    return assignments.map((a) => ({
        ...a,
        products: a.productIds.map((id) => {
            const p = byId.get(id);
            return p
                ? { _id: id, name: p.name, isActive: !!p.isActive, category: p.category?.name || '', exists: true }
                : { _id: id, name: '', isActive: false, category: '', exists: false };
        })
    }));
};

const publicStatus = async () => {
    const doc = await load(true);
    const secretReadable = !!(doc?.encryptedClientSecret && decrypt(doc.encryptedClientSecret));
    const provider = providerMissing(doc, secretReadable);
    const recipients = recipientsMissing(doc);
    return {
        saved: !!doc,
        // Both halves, as before the split; each half is also reported alone.
        configured: provider.length === 0 && recipients.length === 0,
        missing: [...provider, ...recipients],
        provider: { configured: provider.length === 0, missing: provider },
        recipients: { configured: recipients.length === 0, missing: recipients },
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
            notifyNewLoanApplication: doc.notifyNewLoanApplication,
            // One per additional recipient, in the same order.
            recipientProducts: await recipientProductsView(doc)
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

// The validated input, normalised, for whichever half is being saved.
const providerSettingsOf = (input) => ({
    provider: input.provider || 'microsoft365',
    authMethod: input.authMethod || 'graph',
    senderName: String(input.senderName || '').trim(),
    senderEmail: rules.normaliseEmail(input.senderEmail),
    tenantId: String(input.tenantId).trim(),
    clientId: String(input.clientId).trim().toLowerCase()
});

// The recipients and, for each additional recipient, its products. A recipient
// the request says nothing about keeps its saved assignment — or, if it has
// none, stays emailed about every application, as before assignments existed.
// Assignments for removed recipients are dropped. Every product id must name a
// product in the catalogue: the page's list is a convenience, this check is
// what counts.
const recipientSettingsOf = async (input, existing) => {
    const additionalRecipients = (input.additionalRecipients || []).map(rules.normaliseEmail);
    const submitted = new Map((input.recipientProducts || []).map((e) => [rules.normaliseEmail(e.email), e]));
    const saved = new Map((existing?.recipientProducts || []).map((e) => [rules.normaliseEmail(e.email), e]));
    const recipientProducts = additionalRecipients.flatMap((email) => {
        const e = submitted.get(email) || saved.get(email);
        if (!e) return [];
        return [{
            email,
            allProducts: e.allProducts === true,
            productIds: [...new Set((e.productIds || []).map((id) => String(id).toLowerCase()))]
        }];
    });

    const ids = [...new Set(recipientProducts.flatMap((e) => e.productIds))];
    if (ids.length) {
        const found = await Product.find({ _id: { $in: ids } }).select('_id').lean();
        const known = new Set(found.map((p) => String(p._id)));
        const unknown = ids.filter((id) => !known.has(id));
        if (unknown.length) {
            const one = unknown.length === 1;
            throw fieldError('recipientProducts', `${one ? 'This product does' : 'These products do'} not exist: ${unknown.join(', ')}. Remove ${one ? 'it' : 'them'} and save again.`);
        }
    }

    return {
        primaryRecipient: rules.normaliseEmail(input.primaryRecipient),
        additionalRecipients,
        notifyNewLoanApplication: input.notifyNewLoanApplication !== false,
        recipientProducts
    };
};

// A blank client secret keeps the one already stored — the page never has it
// to send back — so a secret is only ever replaced by a new one, never cleared
// by an empty field. Returns the new secret, or '' to keep the stored one.
const secretToSave = (input, existing) => {
    const newSecret = typeof input.clientSecret === 'string' ? input.clientSecret.trim() : '';
    const storedReadable = !!(existing?.encryptedClientSecret && decrypt(existing.encryptedClientSecret));
    if (!newSecret && !storedReadable) {
        throw fieldError('clientSecret', existing?.encryptedClientSecret
            ? 'The saved client secret can no longer be read. Enter it again.'
            : 'Enter the client secret');
    }
    return newSecret;
};

// Writes some fields of the one document, leaving every other field as it is.
const persist = async (existing, settings, { userId, newSecret = '' }) => {
    // A previous test proved a connection that may no longer be the one in
    // use, so it is cleared whenever anything it depended on changes.
    const connectionChanged = !!newSecret
        || CONNECTION_FIELDS.some((k) => k in settings && (!existing || existing[k] !== settings[k]));

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
    return { connectionChanged };
};

// Everything at once — the original Email Settings save, kept for any caller
// of PUT /api/v1/email-settings.
const save = async (input, userId) => {
    const existing = await load(true);
    const newSecret = secretToSave(input, existing);
    await persist(existing, { ...providerSettingsOf(input), ...(await recipientSettingsOf(input, existing)) }, { userId, newSecret });
    logger.info('Email settings updated', { by: String(userId || ''), secretReplaced: !!newSecret });
    return publicStatus();
};

// The Email API card on the API page: credentials and sender only. Recipients
// and the notification preference are left exactly as they are.
const saveProvider = async (input, userId) => {
    const existing = await load(true);
    const newSecret = secretToSave(input, existing);
    await persist(existing, providerSettingsOf(input), { userId, newSecret });
    logger.info('Email provider settings updated', { by: String(userId || ''), secretReplaced: !!newSecret });
    return publicStatus();
};

// Email Settings: recipients, their products and the notification preference
// only. The credentials, the secret and the last test are left exactly as they
// are, and nothing is sent or queued.
const saveRecipients = async (input, userId) => {
    const existing = await load(true);
    await persist(existing, await recipientSettingsOf(input, existing), { userId });
    logger.info('Email notification recipients updated', { by: String(userId || '') });
    return publicStatus();
};

// The saved provider configuration, ready for the Microsoft client — or the
// reason it is not. Shared by both tests and the loan-application emails;
// recipients are the caller's concern (a test email names its own).
const resolveSending = async () => {
    const doc = await load(true);
    const secret = doc?.encryptedClientSecret ? decrypt(doc.encryptedClientSecret) : null;
    const missing = providerMissing(doc, !!secret);
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

module.exports = { publicStatus, save, saveProvider, saveRecipients, testConnection, sendTestEmail, resolveSending, TEST_SUBJECT, PROVIDER_FIELDS, RECIPIENT_FIELDS };
