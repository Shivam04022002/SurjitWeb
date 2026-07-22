const mongoose = require('mongoose');

const BRANCH_STATUS = ['Published', 'Draft'];

const branchSchema = new mongoose.Schema({
    branchName: {
        type: String,
        required: [true, 'Branch name is required'],
        trim: true,
        maxlength: [150, 'Branch name must not exceed 150 characters']
    },
    // Street line only. City, state and pincode are separate so the CMS can
    // filter and sort on them; the website joins them back into the single
    // line it has always shown.
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [300, 'Address must not exceed 300 characters']
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City must not exceed 100 characters']
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        maxlength: [100, 'State must not exceed 100 characters']
    },
    pincode: {
        type: String,
        required: [true, 'Pincode is required'],
        trim: true,
        match: [/^\d{6}$/, 'Pincode must be 6 digits']
    },
    phone: {
        type: String,
        trim: true,
        default: '',
        maxlength: [20, 'Phone must not exceed 20 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        maxlength: [150, 'Email must not exceed 150 characters']
    },
    googleMapUrl: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Google Map URL must not exceed 500 characters']
    },
    status: {
        type: String,
        enum: BRANCH_STATUS,
        default: 'Draft',
        index: true
    },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the public Contact page: published, in display order, oldest first as a
// stable tie-break so equal orders never shuffle between requests.
branchSchema.index({ status: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('Branch', branchSchema);
module.exports.BRANCH_STATUS = BRANCH_STATUS;
