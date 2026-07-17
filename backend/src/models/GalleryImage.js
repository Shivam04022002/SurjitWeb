const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GalleryAlbum',
        required: [true, 'Album reference is required'],
        index: true
    },
    image: {
        url: { type: String, required: [true, 'Image URL is required'] },
        fileName: { type: String, default: '' }
    },
    caption: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Caption must not exceed 500 characters']
    },
    altText: {
        type: String,
        trim: true,
        default: '',
        maxlength: [300, 'Alt text must not exceed 300 characters']
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

galleryImageSchema.index({ album: 1, displayOrder: 1 });
galleryImageSchema.index({ isActive: 1 });
galleryImageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
