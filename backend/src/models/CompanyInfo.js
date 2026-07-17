const mongoose = require('mongoose');

const companyInfoSchema = new mongoose.Schema({
    companyName: {
        type: String,
        trim: true,
        default: ''
    },
    tagline: {
        type: String,
        trim: true,
        default: ''
    },
    aboutDescription: {
        type: String,
        trim: true,
        default: ''
    },
    mission: {
        type: String,
        trim: true,
        default: ''
    },
    vision: {
        type: String,
        trim: true,
        default: ''
    },
    history: {
        type: String,
        trim: true,
        default: ''
    },
    heroTitle: {
        type: String,
        trim: true,
        default: ''
    },
    heroSubtitle: {
        type: String,
        trim: true,
        default: ''
    },
    heroImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    aboutImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CompanyInfo', companyInfoSchema);
