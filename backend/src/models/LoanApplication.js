const mongoose = require('mongoose');

// The four values the collection has always used. `under-review` predates this
// workflow and is kept so existing records and any UI relying on it stay valid.
const LOAN_APPLICATION_STATUS = ['pending', 'under-review', 'approved', 'rejected'];

// One entry per status change. Deliberately holds no applicant data — just the
// transition, who made it and when.
const statusHistorySchema = new mongoose.Schema({
    from: { type: String, enum: LOAN_APPLICATION_STATUS, default: null },
    to: { type: String, enum: LOAN_APPLICATION_STATUS, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

const loanApplicationSchema = new mongoose.Schema({
    // The CMS product this application was started from. Optional because
    // applications submitted before the association existed have none to
    // record, and the generic "Apply Now" entry point still has no product
    // context. loanType below is kept as the coarse classification.
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
        index: true
    },

    // Personal Info
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    pan: { type: String, required: true, trim: true },
    aadhaar: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },

    // Loan Details
    loanType: { type: String, enum: ['business', 'vehicle', 'lap'], required: true },
    loanAmount: { type: Number, required: true },
    loanPurpose: { type: String, required: true, trim: true },
    tenure: { type: Number, required: true },

    // Employment
    employmentType: { type: String, enum: ['self-employed', 'business-owner', 'salaried'], required: true },
    businessName: { type: String, trim: true },
    businessType: { type: String, trim: true },
    monthlyIncome: { type: Number, required: true },
    workExperience: { type: String, required: true, trim: true },

    // Document URLs
    aadhaarCardUrl: { type: String, trim: true },
    panCardUrl: { type: String, trim: true },
    bankStatementUrl: { type: String, trim: true },
    businessProofUrl: { type: String, trim: true },

    // Consent captured at submission. The UI has always required the tick; it
    // was simply never transmitted. Recorded here with the moment it was given.
    consentAccepted: { type: Boolean, default: false },
    consentAcceptedAt: { type: Date, default: null },

    // Application Status
    applicationNumber: { type: String, unique: true },
    status: { type: String, enum: LOAN_APPLICATION_STATUS, default: 'pending' },
    // Append-only audit of who moved the application between statuses.
    statusHistory: { type: [statusHistorySchema], default: [] },
    notes: { type: String, trim: true },

    deletedAt: { type: Date, default: null }
}, {
    timestamps: true
});

loanApplicationSchema.pre('save', async function (next) {
    if (!this.applicationNumber) {
        this.applicationNumber = 'SF' + Date.now().toString().slice(-8);
    }
    next();
});

loanApplicationSchema.pre(/^find/, function (next) {
    if (this.getFilter().deletedAt === undefined) {
        this.where({ deletedAt: null });
    }
    next();
});

loanApplicationSchema.index({ applicationNumber: 1 });
loanApplicationSchema.index({ email: 1 });
loanApplicationSchema.index({ status: 1 });
loanApplicationSchema.index({ loanType: 1 });
// Backs the admin list, which filters by product and sorts newest first.
loanApplicationSchema.index({ product: 1, createdAt: -1 });
loanApplicationSchema.index({ createdAt: -1 });
loanApplicationSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);
module.exports.LOAN_APPLICATION_STATUS = LOAN_APPLICATION_STATUS;
