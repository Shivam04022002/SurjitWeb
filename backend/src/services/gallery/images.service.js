const GalleryImage = require('../../models/GalleryImage');
const GalleryAlbum = require('../../models/GalleryAlbum');
const { AppError } = require('../../middleware/errorHandler');
const { deleteUploadedFile } = require('../upload.service');
const HTTP_STATUS = require('../../constants/httpStatus');

const getImagesByAlbum = async (albumId, filters = {}) => {
    const album = await GalleryAlbum.findById(albumId);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);

    const query = { album: albumId };
    if (filters.isActive !== undefined) query.isActive = filters.isActive;

    return GalleryImage.find(query).sort({ displayOrder: 1, createdAt: -1 });
};

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|ogv|mov)$/i;

// Prefers the mime type the upload reported, falling back to the extension for
// storage backends that hand back a generic content type.
const resolveMediaType = (file) => {
    if (file.mimeType && file.mimeType.startsWith('video/')) return 'video';
    if (file.mimeType && file.mimeType.startsWith('image/')) return 'image';
    return VIDEO_EXTENSIONS.test(file.fileName || file.url || '') ? 'video' : 'image';
};

const createImages = async (albumId, files, bodyData = {}) => {
    const album = await GalleryAlbum.findById(albumId);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);

    const existingCount = await GalleryImage.countDocuments({ album: albumId });

    const images = files.map((file, index) => ({
        album: albumId,
        image: { url: file.url, fileName: file.fileName },
        mediaType: resolveMediaType(file),
        caption: (Array.isArray(bodyData.captions) ? bodyData.captions[index] : bodyData.caption) || '',
        altText: (Array.isArray(bodyData.altTexts) ? bodyData.altTexts[index] : bodyData.altText) || '',
        displayOrder: existingCount + index + 1,
        isActive: true
    }));

    return GalleryImage.insertMany(images);
};

const updateImage = async (id, data) => {
    const image = await GalleryImage.findById(id);
    if (!image) throw new AppError('Image not found', HTTP_STATUS.NOT_FOUND);

    const allowed = ['caption', 'altText', 'displayOrder', 'isActive'];
    allowed.forEach((field) => {
        if (data[field] !== undefined) image[field] = data[field];
    });

    await image.save();
    return image;
};

const deleteImage = async (id) => {
    const image = await GalleryImage.findById(id);
    if (!image) throw new AppError('Image not found', HTTP_STATUS.NOT_FOUND);

    if (image.image && image.image.fileName) {
        await deleteUploadedFile(image.image.fileName);
    }

    await GalleryImage.findByIdAndDelete(id);
    return { deleted: true };
};

const toggleImageStatus = async (id) => {
    const image = await GalleryImage.findById(id);
    if (!image) throw new AppError('Image not found', HTTP_STATUS.NOT_FOUND);
    image.isActive = !image.isActive;
    await image.save();
    return image;
};

const reorderImages = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await GalleryImage.bulkWrite(bulkOps);
    return GalleryImage.find({ _id: { $in: orderedIds } }).sort({ displayOrder: 1 });
};

module.exports = {
    getImagesByAlbum,
    createImages,
    updateImage,
    deleteImage,
    toggleImageStatus,
    reorderImages
};
