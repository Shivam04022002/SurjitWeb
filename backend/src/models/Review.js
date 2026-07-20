const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: [120, 'Customer name must not exceed 120 characters']
    },
    // Optional — the website falls back to an initials circle when absent.
    customerImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
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
    // Free text rather than a Product reference: reviews name the loan a
    // customer took, which may not match a current catalogue entry.
    productName: {
        type: String,
        trim: true,
        default: '',
        maxlength: [150, 'Product name must not exceed 150 characters']
    },
    location: {
        type: String,
        trim: true,
        default: '',
        maxlength: [120, 'Location must not exceed 120 characters']
    },
    isPublished: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the public sidebar: published, ordered, newest first as a tie-break.
reviewSchema.index({ isPublished: 1, displayOrder: 1 });
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
