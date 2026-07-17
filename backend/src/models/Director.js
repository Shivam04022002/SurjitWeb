const mongoose = require('mongoose');

const directorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    designation: {
        type: String,
        required: [true, 'Designation is required'],
        trim: true
    },
    photo: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    linkedinUrl: {
        type: String,
        trim: true,
        default: ''
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

directorSchema.index({ displayOrder: 1 });
directorSchema.index({ isActive: 1 });

module.exports = mongoose.model('Director', directorSchema);
