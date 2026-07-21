const mongoose = require('mongoose');

const REVIEW_STATUS = ['Pending', 'Approved', 'Rejected'];

const reviewSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: [120, 'Customer name must not exceed 120 characters']
    },
    // Collected for verification. Never returned by the public API.
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
        maxlength: [20, 'Mobile number must not exceed 20 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        maxlength: [160, 'Email must not exceed 160 characters']
    },
    city: {
        type: String,
        trim: true,
        default: '',
        maxlength: [120, 'City must not exceed 120 characters']
    },
    // Free text rather than a Product reference: customers name the loan they
    // took, which may not match a current catalogue entry.
    productName: {
        type: String,
        trim: true,
        default: '',
        maxlength: [150, 'Product name must not exceed 150 characters']
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: [1, 'Rating must be between 1 and 5'],
        max: [5, 'Rating must be between 1 and 5']
    },
    review: {
        type: String,
        required: [true, 'Review text is required'],
        trim: true,
        maxlength: [1000, 'Review must not exceed 1000 characters']
    },
    // Optional — the website falls back to an initials circle when absent.
    photo: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    // Submissions are always created Pending by the service; the default here
    // is Approved so any document written before this workflow existed (which
    // used isPublished) still reads as visible rather than silently vanishing.
    status: {
        type: String,
        enum: REVIEW_STATUS,
        default: 'Approved',
        index: true
    },
    approvedAt: { type: Date, default: null },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Stamp on approval, clear when moved back out of Approved.
reviewSchema.pre('save', function (next) {
    if (this.status === 'Approved' && !this.approvedAt) {
        this.approvedAt = new Date();
    }
    if (this.status !== 'Approved') {
        this.approvedAt = null;
    }
    next();
});

// Backs the public sidebar: approved, ordered, newest first as a tie-break.
reviewSchema.index({ status: 1, displayOrder: 1 });
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
module.exports.REVIEW_STATUS = REVIEW_STATUS;
