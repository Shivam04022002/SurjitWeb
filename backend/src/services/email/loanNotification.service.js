const LoanApplication = require('../../models/LoanApplication');
const LoanApplicationNotification = require('../../models/LoanApplicationNotification');
const EmailSetting = require('../../models/EmailSetting');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const graph = require('./microsoftGraph');
const emailConfig = require('./emailConfig.service');
const { buildLoanApplicationEmail, buildMime } = require('./loanApplicationEmail');
const { normaliseEmail } = require('./emailRules');

// "New Loan Application Received" emails.
//
// The order of events is what keeps this safe:
//
//   1. The application is saved. Nothing here runs before that succeeds.
//   2. A delivery record is inserted. Its unique index on the application is
//      the duplicate guard: a second queue for the same application inserts
//      nothing and sends nothing.
//   3. The record is claimed atomically before every send, so two processes,
//      a retry and the sweep can never send the same record at once.
//   4. The email goes out after the customer's response, and whatever happens
//      to it is recorded on the delivery record — never on the application.
//
// Retries are bounded (LOAN_NOTIFICATION_MAX_ATTEMPTS, counting the first) and
// only for failures where Microsoft certainly did not accept the message:
// throttling, Microsoft being unavailable, and sign-in requests that never got
// an answer. A send whose outcome is unknown is not retried — a missed email
// is visible on the record; a duplicate one cannot be taken back. So this is
// at most a few sends per application, never a promise of exactly one.

const RETRYABLE = new Set(['THROTTLED', 'MICROSOFT_UNAVAILABLE', 'NETWORK', 'TIMEOUT']);
const BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
// How long a claimed send may run before the sweep decides the process
// stopped mid-send. Well above the Microsoft client's own timeouts.
const LOCK_MS = 2 * 60 * 1000;
const SWEEP_BATCH = 25;

const maxAttempts = () => Math.max(1, env.LOAN_NOTIFICATION_MAX_ATTEMPTS || 1);

const backoffFor = (attempt, retryAfterSeconds) => Math.max(
    retryAfterSeconds ? retryAfterSeconds * 1000 : 0,
    BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length) - 1]
);

// Sends started from this process that have not finished. Nothing waits on
// them in normal running; tests and a graceful shutdown can.
const inFlight = new Set();
const track = (promise) => {
    inFlight.add(promise);
    // The caller handles the promise's own outcome; this branch only tidies up.
    promise.finally(() => inFlight.delete(promise)).catch(() => {});
    return promise;
};
const whenIdle = async () => { while (inFlight.size) await Promise.allSettled([...inFlight]); };

// The recipients, from the saved Email Settings only — never from a request.
const recipientsOf = (doc) => [...new Set([doc.primaryRecipient, ...(doc.additionalRecipients || [])].map(normaliseEmail).filter(Boolean))];

const finish = (record, $set) => LoanApplicationNotification.updateOne(
    { _id: record._id, status: 'sending' },
    { $set: { lockedUntil: null, ...$set } }
);

// One claimed attempt. Returns the outcome it recorded.
const attempt = async (record) => {
    const settings = await EmailSetting.findOne({ key: EmailSetting.SINGLETON_KEY });
    if (!settings) return { status: 'skipped', outcomeCode: 'NOT_CONFIGURED' };
    if (!settings.notifyNewLoanApplication) return { status: 'skipped', outcomeCode: 'DISABLED' };

    let sending;
    try {
        // Unsupported provider or method, missing or unreadable secret — all
        // reported as NOT_CONFIGURED, and never retried: nothing will change
        // until an administrator changes the settings.
        sending = await emailConfig.resolveSending();
    } catch (err) {
        if (err instanceof graph.MicrosoftError && err.code === 'NOT_CONFIGURED') return { status: 'skipped', outcomeCode: 'NOT_CONFIGURED' };
        throw err;
    }

    const application = await LoanApplication.findById(record.application)
        .select('applicationNumber fullName loanType product createdAt')
        .populate('product', 'name');
    if (!application) return { status: 'skipped', outcomeCode: 'APPLICATION_NOT_FOUND' };

    const to = recipientsOf(sending.doc);
    const email = buildLoanApplicationEmail({ application, productName: application.product?.name || null });
    const mime = buildMime({
        from: { address: sending.doc.senderEmail, name: sending.doc.senderName },
        to,
        ...email
    });

    try {
        await graph.sendMime(sending.credentials, { sender: sending.doc.senderEmail, mime });
        return { status: 'sent', outcomeCode: 'SENT', sentAt: new Date(), recipientCount: to.length };
    } catch (err) {
        if (!(err instanceof graph.MicrosoftError)) throw err;
        const retry = RETRYABLE.has(err.code) && record.attempts < maxAttempts();
        return retry
            ? { status: 'retrying', outcomeCode: err.code, nextAttemptAt: new Date(Date.now() + backoffFor(record.attempts, err.retryAfter)) }
            : { status: 'failed', outcomeCode: err.code };
    }
};

// Claims a due record and makes one attempt. Returns null when the record is
// not due, already finished, or being sent by someone else.
const processRecord = async (recordId) => {
    const now = new Date();
    const record = await LoanApplicationNotification.findOneAndUpdate(
        { _id: recordId, status: { $in: ['pending', 'retrying'] }, nextAttemptAt: { $lte: now } },
        { $set: { status: 'sending', lockedUntil: new Date(now.getTime() + LOCK_MS), lastAttemptAt: now }, $inc: { attempts: 1 } },
        { new: true }
    );
    if (!record) return null;

    let outcome;
    try {
        outcome = await attempt(record);
    } catch (err) {
        // Not a Microsoft answer: the database, or a bug. Nothing was sent
        // (sending is the last step and reports its own errors), so a bounded
        // retry is safe.
        logger.error('Loan application email attempt failed unexpectedly', { applicationNumber: record.applicationNumber, name: err?.name });
        outcome = record.attempts < maxAttempts()
            ? { status: 'retrying', outcomeCode: 'UNEXPECTED', nextAttemptAt: new Date(Date.now() + backoffFor(record.attempts)) }
            : { status: 'failed', outcomeCode: 'UNEXPECTED' };
    }

    await finish(record, outcome);
    const meta = { applicationNumber: record.applicationNumber, attempt: record.attempts, code: outcome.outcomeCode };
    if (outcome.status === 'sent') logger.info('Loan application email sent', { ...meta, recipients: outcome.recipientCount });
    else if (outcome.status === 'skipped') logger.info('Loan application email skipped', meta);
    else logger.warn(outcome.status === 'retrying' ? 'Loan application email will be retried' : 'Loan application email failed', meta);
    return { ...record.toObject(), ...outcome };
};

// Called once the application is saved. Never throws: the customer's
// submission has already succeeded, and nothing here may make it look as if
// it had not. The send itself runs after the response.
const queueForApplication = async (application) => {
    let record;
    try {
        record = await LoanApplicationNotification.create({
            application: application._id,
            applicationNumber: application.applicationNumber
        });
    } catch (err) {
        if (err?.code === 11000) return null; // already queued: the duplicate guard
        logger.error('Could not queue the loan application email', { applicationNumber: application.applicationNumber, name: err?.name });
        return null;
    }
    track(new Promise((resolve) => setImmediate(resolve))
        .then(() => processRecord(record._id))
        .catch((err) => logger.error('Loan application email run failed', { applicationNumber: application.applicationNumber, name: err?.name })));
    return record;
};

// The safety net, run on a timer: retries that have come due, records whose
// immediate send never ran (the process restarted first), and sends that were
// claimed but never finished. Those last ones are closed as SEND_UNCONFIRMED
// rather than retried — the message may have gone out.
const sweep = async () => {
    const now = new Date();
    const stale = await LoanApplicationNotification.updateMany(
        { status: 'sending', lockedUntil: { $lt: now } },
        { $set: { status: 'failed', outcomeCode: 'SEND_UNCONFIRMED', lockedUntil: null } }
    );
    if (stale.modifiedCount) logger.warn('Loan application emails interrupted mid-send were not retried', { count: stale.modifiedCount });

    const due = await LoanApplicationNotification.find({ status: { $in: ['pending', 'retrying'] }, nextAttemptAt: { $lte: now } })
        .sort({ nextAttemptAt: 1 })
        .limit(SWEEP_BATCH)
        .select('_id');
    let processed = 0;
    for (const { _id } of due) {
        if (await track(processRecord(_id))) processed += 1;
    }
    return { processed, interrupted: stale.modifiedCount };
};

module.exports = { queueForApplication, processRecord, sweep, whenIdle, maxAttempts, RETRYABLE, LOCK_MS };
