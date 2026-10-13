const mongoose = require('mongoose');

// The delivery record for the "New Loan Application Received" email: one per
// application, created right after the application is saved.
//
// The unique index on `application` is what makes the email go out at most
// once per application from any path: a second attempt to queue it fails to
// insert, and every send first claims the record atomically.
//
// Deliberately holds no applicant data and no recipient addresses — the
// reference, the outcome, and a code naming why (never Microsoft's own text).
const STATUSES = ['pending', 'sending', 'retrying', 'sent', 'failed', 'skipped'];

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
    // SENT, DISABLED, NOT_CONFIGURED, or the Microsoft error code.
    outcomeCode: { type: String, default: '', maxlength: 60 }
}, {
    timestamps: true
});

loanApplicationNotificationSchema.index({ application: 1 }, { unique: true });
loanApplicationNotificationSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('LoanApplicationNotification', loanApplicationNotificationSchema);
module.exports.STATUSES = STATUSES;
