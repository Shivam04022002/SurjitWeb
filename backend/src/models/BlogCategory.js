const mongoose = require('mongoose');

const blogCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        maxlength: [120, 'Name must not exceed 120 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        maxlength: [150, 'Slug must not exceed 150 characters']
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Description must not exceed 500 characters']
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Lets the CMS list show how much sits under a category before deleting it.
blogCategorySchema.virtual('blogsCount', {
    ref: 'Blog',
    localField: '_id',
    foreignField: 'category',
    count: true
});

// slug's unique:true already creates the index; a second one only warns.
blogCategorySchema.index({ isActive: 1 });
blogCategorySchema.index({ displayOrder: 1 });

module.exports = mongoose.model('BlogCategory', blogCategorySchema);
