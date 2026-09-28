const mongoose = require('mongoose');

// One planned blog: generate this topic on this calendar day.
//
// The day is stored as a 'YYYY-MM-DD' string in the business timezone, not as
// an instant. A plan says "01 Oct", and 01 Oct has to stay 01 Oct however the
// server is set and wherever the admin's browser is — storing a Date would make
// the scheduled day a function of whoever reads it.
//
// A date is not an identity. Several rows may share a day, and each is its own
// blog; what tells them apart is this document's own _id, which is also what
// makes generation idempotent.
const ROW_STATUSES = [
    // Failed the plan's own validation: never scheduled, shown so it can be fixed.
    'invalid',
    // Waiting for its day.
    'scheduled',
    // Claimed by a scheduler run. A row is only ever in this state while a run
    // holds it; the claim is what stops a second run picking it up.
    'generating',
    // A draft exists. `blog` says which one.
    'generated',
    // Generation failed. Retried while attempts remain, then left for the admin.
    'failed',
    // Its day passed without generation — the plan was uploaded late, or the
    // scheduler was not running. Never generated after the fact on its own.
    'missed'
];

const geminiPlanRowSchema = new mongoose.Schema({
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeminiBlogPlan',
        required: true
    },
    // Generation runs as the admin who uploaded the plan: kept here so the
    // scheduler needs one read, not two.
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    // The spreadsheet's row number where there was one, so an error can point
    // at the line the admin is looking at.
    rowNumber: { type: Number, default: null },
    // Position in the plan, which is how the plan is ordered when shown.
    position: { type: Number, required: true },

    // The calendar day to generate on, in the business timezone.
    scheduledDay: {
        type: String,
        required: [true, 'A scheduled day is required'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Scheduled day must be a YYYY-MM-DD calendar day']
    },
    topic: {
        type: String,
        required: [true, 'Topic is required'],
        trim: true,
        maxlength: [200, 'Topic cannot exceed 200 characters']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlogCategory',
        default: null
    },
    // The category's name as it was when the plan was saved, so a renamed or
    // deleted category still shows what the plan asked for.
    categoryName: { type: String, default: null },
    generateImage: { type: Boolean, default: true },

    status: {
        type: String,
        enum: { values: ROW_STATUSES, message: `Status must be one of: ${ROW_STATUSES.join(', ')}` },
        default: 'scheduled'
    },
    // What the plan validator said, for a row that could not be scheduled.
    // Not called `errors`: Mongoose reserves that name on a document for its
    // own validation state, and this row is saved as a document.
    validationErrors: [{
        _id: false,
        field: { type: String },
        message: { type: String }
    }],

    // The draft this row produced. Set once, and the reason a row can never
    // produce a second blog.
    blog: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Blog',
        default: null
    },
    generatedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null }
}, { timestamps: true });

// What the scheduler asks on every run: which rows are due today.
geminiPlanRowSchema.index({ scheduledDay: 1, status: 1 });
// What the Gemini Blogs page asks: this plan's rows, in order.
geminiPlanRowSchema.index({ plan: 1, position: 1 });

module.exports = mongoose.model('GeminiPlanRow', geminiPlanRowSchema);
module.exports.ROW_STATUSES = ROW_STATUSES;
