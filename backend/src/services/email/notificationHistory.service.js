const LoanApplicationNotification = require('../../models/LoanApplicationNotification');
const LoanApplication = require('../../models/LoanApplication');
const { DOCUMENT_TYPES, describeDocuments } = require('../loanApplications/applicationDocuments');
const { productOf } = require('../loanApplications/applicationFields');
const { buildLoanApplicationEmail, adminApplicationUrl } = require('./loanApplicationEmail');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const logger = require('../../utils/logger');
const zoned = require('../../utils/zonedDate');
const notifications = require('./loanNotification.service');

// The Email Delivery Log: what happened to each "New Loan Application
// Received" email, read from the delivery records Phase 3 writes.
//
// Every row is built by viewOf() from a fixed list of fields. The delivery
// records hold no applicant data; the applicant's name, product and document
// count are read from the application itself, and only for a viewer who also
// holds Loan Applications view (the log on its own needs API Settings view).

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

// Staff addresses as "first@… +2": enough to recognise, short enough for a
// table cell. Records from before addresses were kept show only the count.
const recipientSummaryOf = (record) => {
    const list = record.recipients || [];
    if (!list.length) return record.recipientCount ? `${record.recipientCount} recipient${record.recipientCount === 1 ? '' : 's'}` : '';
    return list.length === 1 ? list[0] : `${list[0]} +${list.length - 1}`;
};

const viewOf = (record) => ({
    id: String(record._id),
    applicationNumber: record.applicationNumber,
    status: displayStatusOf(record),
    outcomeCode: record.outcomeCode || '',
    attempts: record.attempts,
    maxAttempts: notifications.maxAttempts(),
    recipientCount: record.recipientCount,
    recipientSummary: recipientSummaryOf(record),
    createdAt: record.createdAt,
    lastAttemptAt: record.lastAttemptAt,
    nextAttemptAt: record.status === 'pending' || record.status === 'retrying' ? record.nextAttemptAt : null,
    sentAt: record.sentAt,
    retryable: isRetryable(record)
});

const FIELDS = 'application applicationNumber status outcomeCode attempts recipientCount recipients content.documents createdAt lastAttemptAt nextAttemptAt sentAt';

// The application columns for a page of records — one query (plus one for
// products) whatever the page size. Only for viewers who also hold Loan
// Applications view: the applicant's name is applicant data.
const APPLICATION_COLUMNS = `applicationNumber fullName loanType product createdAt ${DOCUMENT_TYPES.map((d) => d.field).join(' ')}`;

const applicationColumnsFor = async (records) => {
    const ids = [...new Set(records.map((r) => String(r.application)).filter(Boolean))];
    if (!ids.length) return new Map();
    const apps = await LoanApplication.find({ _id: { $in: ids } })
        .select(APPLICATION_COLUMNS)
        .populate('product', 'name')
        .lean();
    return new Map(apps.map((a) => [String(a._id), a]));
};

const documentCountOf = (app) => DOCUMENT_TYPES.filter((d) => !!app[d.field]).length;

const withApplication = (view, app) => {
    if (!app) return { ...view, applicant: null, applicationMissing: true };
    return {
        ...view,
        applicationMissing: false,
        applicant: {
            name: app.fullName,
            product: productOf(app).label,
            documentCount: documentCountOf(app)
        }
    };
};

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

const list = async ({ status, from, to, page = 1, limit = 20, includeApplicant = false }) => {
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

    let notifications = records.map(viewOf);
    if (includeApplicant) {
        const apps = await applicationColumnsFor(records);
        notifications = notifications.map((v, i) => withApplication(v, apps.get(String(records[i].application))));
    } else {
        // Without Loan Applications access: no applicant data, only how many
        // documents the email listed (from the delivery record itself).
        notifications = notifications.map((v, i) => ({
            ...v,
            applicant: null,
            applicantHidden: true,
            documentCount: (records[i].content?.documents || []).filter((d) => d.status !== 'not_provided').length || null
        }));
    }

    return {
        notifications,
        counts,
        applicantDetails: includeApplicant,
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
};

// One record in full, for the log's detail view. The delivery history is
// always included; the application, its documents and the email preview only
// for viewers who also hold Loan Applications view.
//
// The preview is regenerated from the application as it is now, with the
// current template. The delivery record keeps what the email contained (its
// template version, subject, field list and document statuses), not the
// applicant's values, so the exact historical email is not stored; the
// response says so, and says whether the template or the application has
// changed since it was built.
const detail = async (id, { includeApplicant = false } = {}) => {
    const record = await LoanApplicationNotification.findById(id).lean();
    if (!record) throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);

    const delivery = {
        ...viewOf(record),
        recipients: record.recipients || null,
        events: (record.events || []).map((e) => ({ at: e.at, attempt: e.attempt, status: e.status === 'failed' && e.code === UNCONFIRMED ? 'unconfirmed' : e.status, code: e.code })),
        sent: record.content
            ? {
                templateVersion: record.content.templateVersion,
                subject: record.content.subject,
                generatedAt: record.content.generatedAt,
                fields: record.content.fields || [],
                documents: record.content.documents || []
            }
            : null
    };
    if (!includeApplicant) return { delivery, applicantHidden: true, application: null, documents: null, preview: null };

    const application = await LoanApplication.findById(record.application).populate('product', 'name');
    if (!application) return { delivery, applicantHidden: false, applicationMissing: true, application: null, documents: null, preview: null };

    const documents = await describeDocuments(application);
    const email = buildLoanApplicationEmail({ application, documents });
    const builtAt = record.content?.generatedAt || record.sentAt || record.lastAttemptAt;
    return {
        delivery,
        applicantHidden: false,
        applicationMissing: false,
        application: {
            id: String(application._id),
            applicationNumber: application.applicationNumber,
            applicantName: application.fullName,
            product: email.description.product.label,
            submittedAt: application.createdAt,
            status: application.status,
            adminUrl: adminApplicationUrl(application._id),
            summary: email.description.summary,
            sections: email.description.sections
        },
        documents,
        preview: {
            exact: false,
            kind: 'regenerated',
            subject: email.subject,
            html: email.html,
            text: email.text,
            templateVersion: email.templateVersion,
            sentTemplateVersion: record.content?.templateVersion || null,
            applicationChangedSinceSent: !!(builtAt && application.updatedAt && application.updatedAt > builtAt)
        }
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

module.exports = { list, detail, retryNow, DISPLAY_STATUSES, isRetryable, viewOf };
