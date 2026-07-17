const mongoose = require('mongoose');

const imageSubDoc = {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    size: { type: Number, default: 0 }
};

// ── Section Sub-documents ─────────────────────────────────────────────────────

const featureSchema = new mongoose.Schema({
    icon: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    title: {
        type: String,
        required: [true, 'Feature title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Description must not exceed 1000 characters']
    },
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

const eligibilitySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Eligibility title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Description must not exceed 1000 characters']
    },
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Document title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Description must not exceed 1000 characters']
    },
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

const interestRateSchema = new mongoose.Schema({
    loanAmountFrom: {
        type: Number,
        required: [true, 'Loan amount from is required'],
        min: [0, 'Loan amount must be non-negative']
    },
    loanAmountTo: {
        type: Number,
        required: [true, 'Loan amount to is required'],
        min: [0, 'Loan amount must be non-negative']
    },
    interestRate: {
        type: Number,
        required: [true, 'Interest rate is required'],
        min: [0, 'Interest rate must be non-negative'],
        max: [100, 'Interest rate must not exceed 100']
    },
    tenure: {
        type: String,
        trim: true,
        default: '',
        maxlength: [100, 'Tenure must not exceed 100 characters']
    },
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

const faqSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, 'Question is required'],
        trim: true,
        maxlength: [500, 'Question must not exceed 500 characters']
    },
    answer: {
        type: String,
        required: [true, 'Answer is required'],
        trim: true,
        maxlength: [2000, 'Answer must not exceed 2000 characters']
    },
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

const emiConfigSchema = new mongoose.Schema({
    minimumAmount: { type: Number, default: 10000, min: 0 },
    maximumAmount: { type: Number, default: 5000000, min: 0 },
    defaultAmount: { type: Number, default: 100000, min: 0 },
    interestRate: { type: Number, default: 12, min: 0, max: 100 },
    minimumTenure: { type: Number, default: 6, min: 1 },
    maximumTenure: { type: Number, default: 84, min: 1 },
    defaultTenure: { type: Number, default: 24, min: 1 }
}, { _id: false });

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

// ── Main Product Schema ───────────────────────────────────────────────────────

const productSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductCategory',
        required: [true, 'Category is required']
    },
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [200, 'Name must not exceed 200 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        maxlength: [200, 'Slug must not exceed 200 characters']
    },
    heroTitle: {
        type: String,
        trim: true,
        default: '',
        maxlength: [300, 'Hero title must not exceed 300 characters']
    },
    heroDescription: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Hero description must not exceed 1000 characters']
    },
    shortDescription: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Short description must not exceed 500 characters']
    },
    longDescription: {
        type: String,
        trim: true,
        default: ''
    },
    heroImage: imageSubDoc,
    bannerImage: imageSubDoc,
    thumbnailImage: imageSubDoc,
    displayOrder: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    features: [featureSchema],
    eligibility: [eligibilitySchema],
    documents: [documentSchema],
    interestRates: [interestRateSchema],
    faqs: [faqSchema],
    emiConfig: {
        type: emiConfigSchema,
        default: () => ({})
    },
    seo: {
        type: seoSchema,
        default: () => ({})
    }
}, {
    timestamps: true
});

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1 });
productSchema.index({ displayOrder: 1 });
productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
