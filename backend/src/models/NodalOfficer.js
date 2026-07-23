const mongoose = require('mongoose');

const NODAL_STATUS = ['Published', 'Draft'];

const nodalOfficerSchema = new mongoose.Schema({
    // The organisation this officer represents, e.g. "Surjit Finance". The public
    // card heading reads "{companyName}'s Nodal Officer Details".
    companyName: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true,
        maxlength: [150, 'Company name must not exceed 150 characters']
    },
    officerName: {
        type: String,
        required: [true, 'Officer name is required'],
        trim: true,
        maxlength: [120, 'Officer name must not exceed 120 characters']
    },
    designation: {
        type: String,
        required: [true, 'Designation is required'],
        trim: true,
        maxlength: [200, 'Designation must not exceed 200 characters']
    },
    // Stored with newlines; the website renders each line on its own row, as the
    // original hardcoded cards did.
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [400, 'Address must not exceed 400 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        maxlength: [150, 'Email must not exceed 150 characters']
    },
    phone: {
        type: String,
        required: [true, 'Phone is required'],
        trim: true,
        maxlength: [30, 'Phone must not exceed 30 characters']
    },
    status: {
        type: String,
        enum: NODAL_STATUS,
        default: 'Draft',
        index: true
    },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the public Nodal Officer page: published, in display order, oldest first
// as a stable tie-break so equal orders never shuffle between requests.
nodalOfficerSchema.index({ status: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('NodalOfficer', nodalOfficerSchema);
module.exports.NODAL_STATUS = NODAL_STATUS;
