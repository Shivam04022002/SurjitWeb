const mongoose = require('mongoose');

const galleryAlbumSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Album title is required'],
        trim: true,
        maxlength: [200, 'Title must not exceed 200 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        trim: true,
        lowercase: true,
        unique: true,
        maxlength: [250, 'Slug must not exceed 250 characters']
    },
    description: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Description must not exceed 1000 characters']
    },
    coverImage: {
        url: { type: String, default: '' },
        fileName: { type: String, default: '' }
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

galleryAlbumSchema.virtual('imagesCount', {
    ref: 'GalleryImage',
    localField: '_id',
    foreignField: 'album',
    count: true
});

galleryAlbumSchema.index({ slug: 1 }, { unique: true });
galleryAlbumSchema.index({ isActive: 1 });
galleryAlbumSchema.index({ displayOrder: 1 });
galleryAlbumSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GalleryAlbum', galleryAlbumSchema);
