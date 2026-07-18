const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GalleryAlbum',
        required: [true, 'Album reference is required'],
        index: true
    },
    // Holds the uploaded file for both images and videos. The field keeps its
    // original name so every existing document, query and API response stays
    // valid — mediaType below is what distinguishes the two.
    image: {
        url: { type: String, required: [true, 'Image URL is required'] },
        fileName: { type: String, default: '' }
    },
    // Mongoose applies this default when hydrating documents that predate the
    // field, so albums created before video support read back as images with
    // no migration required.
    mediaType: {
        type: String,
        enum: ['image', 'video'],
        default: 'image'
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
