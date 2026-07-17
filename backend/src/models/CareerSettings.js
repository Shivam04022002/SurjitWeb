const mongoose = require('mongoose');

const imageSubDoc = {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    size: { type: Number, default: 0 }
};

const seoSchema = new mongoose.Schema({
    metaTitle: { type: String, trim: true, default: '', maxlength: [160, 'Meta title must not exceed 160 characters'] },
    metaDescription: { type: String, trim: true, default: '', maxlength: [320, 'Meta description must not exceed 320 characters'] },
    metaKeywords: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    ogImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    }
}, { _id: false });

const careerSettingsSchema = new mongoose.Schema({
    heroTitle: { type: String, trim: true, default: '', maxlength: [300, 'Hero title must not exceed 300 characters'] },
    heroSubtitle: { type: String, trim: true, default: '', maxlength: [600, 'Hero subtitle must not exceed 600 characters'] },
    heroBannerImage: imageSubDoc,
    joinOurTeamTitle: { type: String, trim: true, default: '', maxlength: [300, 'Join Our Team title must not exceed 300 characters'] },
    joinOurTeamDescription: { type: String, trim: true, default: '' },
    whyJoinTitle: { type: String, trim: true, default: '', maxlength: [300, 'Why Join title must not exceed 300 characters'] },
    whyJoinDescription: { type: String, trim: true, default: '' },
    whyJoinImage: imageSubDoc,
    seo: { type: seoSchema, default: () => ({}) }
}, {
    timestamps: true
});

module.exports = mongoose.model('CareerSettings', careerSettingsSchema);
