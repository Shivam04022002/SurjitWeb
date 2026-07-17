const imagesService = require('../../services/gallery/images.service');
const { buildFileResult } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getImagesByAlbum = asyncHandler(async (req, res) => {
    const { isActive } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const images = await imagesService.getImagesByAlbum(req.params.albumId, filters);
    return sendSuccess(res, 'Images fetched successfully', { images });
});

const createImages = asyncHandler(async (req, res) => {
    const files = (req.files || []).map((f) => buildFileResult(f));

    if (!files.length) {
        const { AppError } = require('../../middleware/errorHandler');
        throw new AppError('At least one image file is required', HTTP_STATUS.BAD_REQUEST);
    }

    const images = await imagesService.createImages(req.params.albumId, files, req.body);
    return sendSuccess(res, `${images.length} image(s) uploaded successfully`, { images }, HTTP_STATUS.CREATED);
});

const updateImage = asyncHandler(async (req, res) => {
    const image = await imagesService.updateImage(req.params.id, req.body);
    return sendSuccess(res, 'Image updated successfully', { image });
});

const deleteImage = asyncHandler(async (req, res) => {
    await imagesService.deleteImage(req.params.id);
    return sendSuccess(res, 'Image deleted successfully', {});
});

const toggleImageStatus = asyncHandler(async (req, res) => {
    const image = await imagesService.toggleImageStatus(req.params.id);
    return sendSuccess(res, `Image ${image.isActive ? 'activated' : 'deactivated'} successfully`, { image });
});

const reorderImages = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const images = await imagesService.reorderImages(ids);
    return sendSuccess(res, 'Images reordered successfully', { images });
});

module.exports = {
    getImagesByAlbum,
    createImages,
    updateImage,
    deleteImage,
    toggleImageStatus,
    reorderImages
};
