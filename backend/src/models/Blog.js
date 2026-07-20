const mongoose = require('mongoose');

const imageSubDoc = {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    size: { type: Number, default: 0 }
};

const BLOG_STATUS = ['draft', 'published'];

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Blog title is required'],
        trim: true,
        maxlength: [250, 'Title must not exceed 250 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        maxlength: [300, 'Slug must not exceed 300 characters']
    },
    summary: {
        type: String,
        required: [true, 'Short description is required'],
        trim: true,
        maxlength: [1000, 'Short description must not exceed 1000 characters']
    },
    // Rich text from the CMS editor, stored as HTML.
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    featuredImage: imageSubDoc,
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlogCategory',
        default: null,
        index: true
    },
    author: {
        type: String,
        trim: true,
        default: 'Surjit Finance',
        maxlength: [120, 'Author must not exceed 120 characters']
    },
    tags: [{ type: String, trim: true }],
    // Minutes. Derived from the content on save when the editor leaves it blank.
    readingTime: { type: Number, default: 0 },
    status: {
        type: String,
        enum: BLOG_STATUS,
        default: 'draft',
        index: true
    },
    publishedAt: { type: Date, default: null },
    seo: {
        metaTitle: { type: String, trim: true, default: '' },
        metaDescription: { type: String, trim: true, default: '' },
        metaKeywords: { type: String, trim: true, default: '' },
        ogImage: imageSubDoc
    }
}, {
    timestamps: true
});

// Roughly 200 words a minute, the usual reading-time convention. Runs off the
// text content so editor markup does not inflate the estimate.
blogSchema.pre('save', function (next) {
    if (!this.readingTime && this.content) {
        const words = String(this.content).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
        this.readingTime = Math.max(1, Math.round(words / 200));
    }
    // Stamp the first publish; unpublishing clears it so a redraft does not
    // keep an old public date.
    if (this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    if (this.status === 'draft') {
        this.publishedAt = null;
    }
    next();
});

// slug's unique:true already creates the index; a second one only warns.
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ createdAt: -1 });
// Backs the CMS and public search across title, summary, author and tags.
blogSchema.index({ title: 'text', summary: 'text', author: 'text', tags: 'text' });

module.exports = mongoose.model('Blog', blogSchema);
module.exports.BLOG_STATUS = BLOG_STATUS;
