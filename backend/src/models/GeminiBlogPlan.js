const mongoose = require('mongoose');

// A monthly blog plan, as uploaded.
//
// The plan itself is only a heading: who uploaded which spreadsheet, and when.
// What is scheduled lives in GeminiPlanRow, one document per row, because the
// scheduler asks "what is due today?" across every plan rather than "what is in
// this plan?".
//
// One plan is active at a time. Uploading a new one archives the previous, so
// the Gemini Blogs page always has a single current plan to show, and archived
// plans keep their rows and their generated blogs for the record.
const PLAN_STATUSES = ['active', 'archived'];

const geminiBlogPlanSchema = new mongoose.Schema({
    // The spreadsheet's filename, or a name the admin gave the plan.
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true,
        maxlength: [200, 'Plan name cannot exceed 200 characters']
    },
    // Who uploaded it. Generation is attributed to this admin, so the Gemini
    // per-admin concurrency limit and the draft's idempotency key behave
    // exactly as they do when that admin generates a row by hand.
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    status: {
        type: String,
        enum: { values: PLAN_STATUSES, message: 'Status must be active or archived' },
        default: 'active'
    },
    archivedAt: { type: Date, default: null }
}, { timestamps: true });

geminiBlogPlanSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('GeminiBlogPlan', geminiBlogPlanSchema);
module.exports.PLAN_STATUSES = PLAN_STATUSES;
