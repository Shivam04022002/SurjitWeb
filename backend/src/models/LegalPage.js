const mongoose = require('mongoose');

const LEGAL_STATUS = ['Published', 'Draft'];
// The legal pages the website links to from its footer. The type pins a page to
// a purpose; the slug is what the public routes resolve on. (Nodal Officer is a
// separate CMS module and is no longer a legal-page type.)
const LEGAL_TYPES = ['privacy', 'refund', 'terms'];

const legalPageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        maxlength: [200, 'Slug must not exceed 200 characters']
    },
    type: {
        type: String,
        required: [true, 'Type is required'],
        enum: LEGAL_TYPES,
        index: true
    },
    // A short lead line shown under the page heading (used by the Nodal page).
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Description must not exceed 500 characters']
    },
    // Rich text from the CMS editor, stored as HTML — the body of the page.
    content: {
        type: String,
        default: ''
    },
    // Optional downloadable document. `url` may point at an uploaded file
    // (fileName set) or an external link (fileName empty), so a page can carry
    // a PDF without one having to be re-uploaded on migration.
    pdf: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 },
        originalName: { type: String, default: '' }
    },
    seoTitle: {
        type: String,
        trim: true,
        default: '',
        maxlength: [200, 'SEO title must not exceed 200 characters']
    },
    seoDescription: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'SEO description must not exceed 500 characters']
    },
    status: {
        type: String,
        enum: LEGAL_STATUS,
        default: 'Draft',
        index: true
    },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Backs the public footer links: published, in display order, oldest first as a
// stable tie-break so equal orders never shuffle between requests.
legalPageSchema.index({ status: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('LegalPage', legalPageSchema);
module.exports.LEGAL_STATUS = LEGAL_STATUS;
module.exports.LEGAL_TYPES = LEGAL_TYPES;
