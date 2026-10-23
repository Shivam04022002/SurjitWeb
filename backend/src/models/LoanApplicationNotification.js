const mongoose = require('mongoose');

// The delivery record for the "New Loan Application Received" email: one per
// application, created right after the application is saved.
//
// The unique index on `application` is what makes the email go out at most
// once per application from any path: a second attempt to queue it fails to
// insert, and every send first claims the record atomically.
//
// Holds no applicant data: the reference, the outcome, a code naming why
// (never Microsoft's own text), the staff addresses it went to, an attempt
// history, and a description of what the email contained — its template
// version, subject, which fields it included and each document's status —
// but not the applicant's values. The CMS regenerates the content from the
// application when an admin with Loan Applications access asks to see it.
// All of these were added later; older records simply lack them.
const STATUSES = ['pending', 'sending', 'retrying', 'sent', 'failed', 'skipped'];

const eventSchema = new mongoose.Schema({
    at: { type: Date, required: true },
    // Null when the event was recorded in bulk (an interrupted send closed by
    // the sweep), where the attempt number is on the record itself.
    attempt: { type: Number, default: null },
    status: { type: String, enum: STATUSES, required: true },
    code: { type: String, default: '', maxlength: 60 }
}, { _id: false });

const contentSchema = new mongoose.Schema({
    templateVersion: { type: String, default: '', maxlength: 40 },
    subject: { type: String, default: '', maxlength: 250 },
    generatedAt: { type: Date, default: null },
    fields: { type: [{ type: String, maxlength: 80 }], default: [] },
    documents: {
        type: [new mongoose.Schema({
            type: { type: String, maxlength: 40 },
            label: { type: String, maxlength: 60 },
            status: { type: String, maxlength: 20 }
        }, { _id: false })],
        default: []
    }
}, { _id: false });

const loanApplicationNotificationSchema = new mongoose.Schema({
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    applicationNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0, min: 0 },
    // When a pending or retrying record is next due.
    nextAttemptAt: { type: Date, default: Date.now },
    // A claimed send holds the record until then; a claim past it means the
    // process stopped mid-send.
    lockedUntil: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0, min: 0 },
    // The staff addresses (from Email Settings) the last built email was
    // addressed to.
    recipients: { type: [{ type: String, maxlength: 254 }], default: undefined },
    content: { type: contentSchema, default: undefined },
    // One entry per finished attempt, newest last, capped.
    events: { type: [eventSchema], default: undefined },
    // SENT, DISABLED, NOT_CONFIGURED, PRODUCT_NOT_SELECTED, or the Microsoft
    // error code.
    outcomeCode: { type: String, default: '', maxlength: 60 }
}, {
    timestamps: true
});

loanApplicationNotificationSchema.index({ application: 1 }, { unique: true });
loanApplicationNotificationSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('LoanApplicationNotification', loanApplicationNotificationSchema);
module.exports.STATUSES = STATUSES;
