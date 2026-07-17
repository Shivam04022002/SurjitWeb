const GalleryAlbum = require('../../models/GalleryAlbum');
const GalleryImage = require('../../models/GalleryImage');
const { AppError } = require('../../middleware/errorHandler');
const { deleteUploadedFile } = require('../upload.service');
const HTTP_STATUS = require('../../constants/httpStatus');

const getAllAlbums = async (filters = {}) => {
    const query = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.search) query.title = new RegExp(filters.search, 'i');

    const albums = await GalleryAlbum.find(query)
        .populate('imagesCount')
        .sort({ displayOrder: 1, createdAt: -1 });

    return albums;
};

const getAlbumById = async (id) => {
    const album = await GalleryAlbum.findById(id).populate('imagesCount');
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);
    return album;
};

const slugExists = async (slug, excludeId = null) => {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    return !!(await GalleryAlbum.findOne(query));
};

const createAlbum = async (data, coverImageFile) => {
    if (await slugExists(data.slug)) {
        throw new AppError('An album with this slug already exists', HTTP_STATUS.CONFLICT);
    }

    const albumCount = await GalleryAlbum.countDocuments();
    if (data.displayOrder === undefined || data.displayOrder === null) {
        data.displayOrder = albumCount + 1;
    }

    if (coverImageFile) {
        data.coverImage = {
            url: coverImageFile.url,
            fileName: coverImageFile.fileName
        };
    }

    return GalleryAlbum.create(data);
};

const updateAlbum = async (id, data, coverImageFile) => {
    const album = await GalleryAlbum.findById(id);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);

    if (data.slug && data.slug !== album.slug) {
        if (await slugExists(data.slug, id)) {
            throw new AppError('An album with this slug already exists', HTTP_STATUS.CONFLICT);
        }
    }

    if (coverImageFile) {
        if (album.coverImage && album.coverImage.fileName) {
            await deleteUploadedFile(album.coverImage.fileName);
        }
        data.coverImage = {
            url: coverImageFile.url,
            fileName: coverImageFile.fileName
        };
    }

    Object.assign(album, data);
    await album.save();
    return GalleryAlbum.findById(id).populate('imagesCount');
};

const deleteAlbum = async (id) => {
    const album = await GalleryAlbum.findById(id);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);

    // Delete all images in album
    const images = await GalleryImage.find({ album: id });
    for (const img of images) {
        if (img.image && img.image.fileName) {
            await deleteUploadedFile(img.image.fileName);
        }
    }
    await GalleryImage.deleteMany({ album: id });

    // Delete cover image
    if (album.coverImage && album.coverImage.fileName) {
        await deleteUploadedFile(album.coverImage.fileName);
    }

    await GalleryAlbum.findByIdAndDelete(id);
    return { deleted: true };
};

const toggleAlbumStatus = async (id) => {
    const album = await GalleryAlbum.findById(id);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);
    album.isActive = !album.isActive;
    await album.save();
    return album;
};

const reorderAlbums = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { displayOrder: index + 1 } }
        }
    }));
    await GalleryAlbum.bulkWrite(bulkOps);
    return GalleryAlbum.find().populate('imagesCount').sort({ displayOrder: 1 });
};

module.exports = {
    getAllAlbums,
    getAlbumById,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    toggleAlbumStatus,
    reorderAlbums
};
