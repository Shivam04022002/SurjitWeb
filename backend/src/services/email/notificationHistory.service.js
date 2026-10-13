const LoanApplicationNotification = require('../../models/LoanApplicationNotification');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const logger = require('../../utils/logger');
const zoned = require('../../utils/zonedDate');
const notifications = require('./loanNotification.service');

// The Email Delivery Log: what happened to each "New Loan Application
// Received" email, read from the delivery records Phase 3 writes.
//
// Every row is built by viewOf() from a fixed list of fields. The records hold
// no applicant data or recipient addresses to begin with; the whitelist keeps
// it that way if the model ever grows.

// A failed record closed as SEND_UNCONFIRMED is its own state here: Microsoft
// may or may not have accepted the message, which is different from a refusal.
const UNCONFIRMED = 'SEND_UNCONFIRMED';
const DISPLAY_STATUSES = ['pending', 'sending', 'retrying', 'sent', 'skipped', 'failed', 'unconfirmed'];

const displayStatusOf = (record) => (record.status === 'failed' && record.outcomeCode === UNCONFIRMED ? 'unconfirmed' : record.status);

// The only manual retry offered: bringing forward a retry the service has
// already scheduled. A record is `retrying` only after a temporary failure with
// attempts left, so this never adds attempts, never touches a permanent
// failure, a skip or an unconfirmed send, and the send still goes through the
// service's claim. Throttled records are left to their scheduled time — that is
// the wait Microsoft asked for.
const isRetryable = (record) => record.status === 'retrying'
    && record.outcomeCode !== 'THROTTLED'
    && record.attempts < notifications.maxAttempts();

const viewOf = (record) => ({
    id: String(record._id),
    applicationNumber: record.applicationNumber,
    status: displayStatusOf(record),
    outcomeCode: record.outcomeCode || '',
    attempts: record.attempts,
    maxAttempts: notifications.maxAttempts(),
    recipientCount: record.recipientCount,
    createdAt: record.createdAt,
    lastAttemptAt: record.lastAttemptAt,
    nextAttemptAt: record.status === 'pending' || record.status === 'retrying' ? record.nextAttemptAt : null,
    sentAt: record.sentAt,
    retryable: isRetryable(record)
});

const FIELDS = 'applicationNumber status outcomeCode attempts recipientCount createdAt lastAttemptAt nextAttemptAt sentAt';

// The query for a display status. `failed` excludes the unconfirmed ones.
const statusQuery = (status) => {
    if (!status) return {};
    if (status === 'unconfirmed') return { status: 'failed', outcomeCode: UNCONFIRMED };
    if (status === 'failed') return { status: 'failed', outcomeCode: { $ne: UNCONFIRMED } };
    return { status };
};

// From and to are calendar days in the business timezone, both inclusive.
const dateQuery = ({ from, to }) => {
    const createdAt = {};
    if (from) createdAt.$gte = zoned.startOfDay(from);
    if (to) createdAt.$lt = zoned.startOfDay(zoned.addDays(to, 1));
    return Object.keys(createdAt).length ? { createdAt } : {};
};

const list = async ({ status, from, to, page = 1, limit = 20 }) => {
    const range = dateQuery({ from, to });
    const query = { ...range, ...statusQuery(status) };

    const [records, total, grouped] = await Promise.all([
        LoanApplicationNotification.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select(FIELDS)
            .lean(),
        LoanApplicationNotification.countDocuments(query),
        // Counts per status over the date range, for the summary — not narrowed
        // by the status filter, so every count stays visible while one is chosen.
        LoanApplicationNotification.aggregate([
            { $match: range },
            { $group: { _id: { status: '$status', unconfirmed: { $eq: ['$outcomeCode', UNCONFIRMED] } }, n: { $sum: 1 } } }
        ])
    ]);

    const counts = Object.fromEntries(DISPLAY_STATUSES.map((s) => [s, 0]));
    for (const g of grouped) {
        const key = g._id.status === 'failed' && g._id.unconfirmed ? 'unconfirmed' : g._id.status;
        if (key in counts) counts[key] += g.n;
    }

    return {
        notifications: records.map(viewOf),
        counts,
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
};

// Brings an eligible retry forward and runs it now. The eligibility check and
// the change of due time are one atomic update, so a record the sweep claims
// in the meantime — or one that stops being eligible — is refused, not resent.
const retryNow = async (id, userId) => {
    const exists = await LoanApplicationNotification.exists({ _id: id });
    if (!exists) throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);

    const made = await LoanApplicationNotification.findOneAndUpdate(
        {
            _id: id,
            status: 'retrying',
            outcomeCode: { $ne: 'THROTTLED' },
            attempts: { $lt: notifications.maxAttempts() }
        },
        { $set: { nextAttemptAt: new Date() } },
        { new: true }
    );
    if (!made) {
        throw new AppError('This notification cannot be retried now. Only a scheduled retry after a temporary failure can be brought forward.', HTTP_STATUS.CONFLICT);
    }

    logger.info('Loan application email retry requested', { applicationNumber: made.applicationNumber, by: String(userId || '') });
    // The service's own claim decides whether this run sends. If the sweep got
    // there first, this run finds nothing to claim and sends nothing.
    await notifications.processRecord(made._id);
    const after = await LoanApplicationNotification.findById(made._id).select(FIELDS).lean();
    return viewOf(after);
};

module.exports = { list, retryNow, DISPLAY_STATUSES, isRetryable, viewOf };
