const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
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
    shortDescription: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Short description must not exceed 500 characters']
    },
    bannerImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
    },
    icon: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' },
        size: { type: Number, default: 0 }
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

productCategorySchema.index({ slug: 1 }, { unique: true });
productCategorySchema.index({ displayOrder: 1 });
productCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('ProductCategory', productCategorySchema);
