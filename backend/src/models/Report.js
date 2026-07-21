const mongoose = require('mongoose');

const REPORT_STATUS = ['Published', 'Draft'];

const reportSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Report title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    year: {
        type: Number,
        required: [true, 'Year is required'],
        min: [1900, 'Enter a valid year'],
        max: [2200, 'Enter a valid year']
    },
    // Display label such as "2024-25". Kept separate from `year` so the cards
    // can show the financial year while sorting stays numeric.
    financialYear: {
        type: String,
        trim: true,
        default: '',
        maxlength: [20, 'Financial year must not exceed 20 characters']
    },
    pdf: {
        url: { type: String, required: [true, 'PDF file is required'] },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 },
        // The name the visitor sees when downloading, rather than the
        // randomised storage key.
        originalName: { type: String, default: '' }
    },
    thumbnail: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Description must not exceed 1000 characters']
    },
    status: {
        type: String,
        enum: REPORT_STATUS,
        default: 'Draft',
        index: true
    },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the public page: published, ordered, newest first as a tie-break.
reportSchema.index({ status: 1, displayOrder: 1, year: -1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_STATUS = REPORT_STATUS;
