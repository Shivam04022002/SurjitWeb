const mongoose = require('mongoose');

const imageSubDoc = {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    size: { type: Number, default: 0 }
};

const globalSettingsSchema = new mongoose.Schema({
    // ── Company ────────────────────────────────────────────────────────────────
    companyName: {
        type: String, trim: true, default: '',
        maxlength: [200, 'Company name must not exceed 200 characters']
    },
    tagline: {
        type: String, trim: true, default: '',
        maxlength: [500, 'Tagline must not exceed 500 characters']
    },
    companyDescription: {
        type: String, trim: true, default: ''
    },

    // ── Branding ───────────────────────────────────────────────────────────────
    primaryLogo: imageSubDoc,
    whiteLogo: imageSubDoc,
    mobileLogo: imageSubDoc,
    favicon: imageSubDoc,

    // ── Contact ────────────────────────────────────────────────────────────────
    phone: {
        type: String, trim: true, default: '',
        maxlength: [20, 'Phone must not exceed 20 characters']
    },
    alternatePhone: {
        type: String, trim: true, default: '',
        maxlength: [20, 'Alternate phone must not exceed 20 characters']
    },
    tollFreeNumber: {
        type: String, trim: true, default: '',
        maxlength: [20, 'Toll free number must not exceed 20 characters']
    },
    email: {
        type: String, trim: true, lowercase: true, default: '',
        maxlength: [200, 'Email must not exceed 200 characters']
    },
    supportEmail: {
        type: String, trim: true, lowercase: true, default: '',
        maxlength: [200, 'Support email must not exceed 200 characters']
    },
    whatsappNumber: {
        type: String, trim: true, default: '',
        maxlength: [20, 'WhatsApp number must not exceed 20 characters']
    },

    // ── Address ────────────────────────────────────────────────────────────────
    officeAddress: {
        type: String, trim: true, default: '',
        maxlength: [500, 'Office address must not exceed 500 characters']
    },
    city: {
        type: String, trim: true, default: '',
        maxlength: [100, 'City must not exceed 100 characters']
    },
    state: {
        type: String, trim: true, default: '',
        maxlength: [100, 'State must not exceed 100 characters']
    },
    country: {
        type: String, trim: true, default: 'India',
        maxlength: [100, 'Country must not exceed 100 characters']
    },
    pinCode: {
        type: String, trim: true, default: '',
        maxlength: [10, 'PIN code must not exceed 10 characters']
    },
    googleMapsUrl: {
        type: String, trim: true, default: '',
        maxlength: [1000, 'Google Maps URL must not exceed 1000 characters']
    },

    // ── Social Media ───────────────────────────────────────────────────────────
    facebook: { type: String, trim: true, default: '', maxlength: [500, 'URL must not exceed 500 characters'] },
    instagram: { type: String, trim: true, default: '', maxlength: [500, 'URL must not exceed 500 characters'] },
    linkedin: { type: String, trim: true, default: '', maxlength: [500, 'URL must not exceed 500 characters'] },
    youtube: { type: String, trim: true, default: '', maxlength: [500, 'URL must not exceed 500 characters'] },
    twitter: { type: String, trim: true, default: '', maxlength: [500, 'URL must not exceed 500 characters'] },

    // ── Header ─────────────────────────────────────────────────────────────────
    headerPrimaryButtonText: {
        type: String, trim: true, default: '',
        maxlength: [100, 'Button text must not exceed 100 characters']
    },
    headerPrimaryButtonUrl: {
        type: String, trim: true, default: '',
        maxlength: [500, 'Button URL must not exceed 500 characters']
    },
    headerSecondaryButtonText: {
        type: String, trim: true, default: '',
        maxlength: [100, 'Button text must not exceed 100 characters']
    },
    headerSecondaryButtonUrl: {
        type: String, trim: true, default: '',
        maxlength: [500, 'Button URL must not exceed 500 characters']
    },

    // ── Footer ─────────────────────────────────────────────────────────────────
    footerDescription: {
        type: String, trim: true, default: '',
        maxlength: [1000, 'Footer description must not exceed 1000 characters']
    },
    copyright: {
        type: String, trim: true, default: '',
        maxlength: [300, 'Copyright text must not exceed 300 characters']
    },
    footerNote: {
        type: String, trim: true, default: '',
        maxlength: [500, 'Footer note must not exceed 500 characters']
    },

    // ── Business Hours ─────────────────────────────────────────────────────────
    businessHours: {
        monday:    { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        tuesday:   { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        wednesday: { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        thursday:  { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        friday:    { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        saturday:  { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] },
        sunday:    { type: String, trim: true, default: '', maxlength: [100, 'Hours must not exceed 100 characters'] }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
