const mongoose = require('mongoose');

const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];

const jobApplicationSchema = new mongoose.Schema({
    applicantName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    resumeUrl: { type: String, trim: true, default: '' },
    resumeFileName: { type: String, trim: true, default: '' },
    appliedPosition: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobOpening',
        default: null
    },
    appliedPositionTitle: { type: String, trim: true, default: '' },
    coverLetter: { type: String, trim: true, default: '' },
    status: {
        type: String,
        enum: {
            values: APPLICATION_STATUSES,
            message: 'Status must be one of: new, reviewed, shortlisted, interview_scheduled, selected, rejected'
        },
        default: 'new'
    },
    deletedAt: { type: Date, default: null }
}, {
    timestamps: true
});

jobApplicationSchema.pre(/^find/, function (next) {
    if (this.getFilter().deletedAt === undefined) {
        this.where({ deletedAt: null });
    }
    next();
});

jobApplicationSchema.index({ email: 1 });
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ appliedPosition: 1 });
jobApplicationSchema.index({ appliedPositionTitle: 1 });
jobApplicationSchema.index({ createdAt: -1 });
jobApplicationSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
