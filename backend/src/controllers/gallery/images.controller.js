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
    // buildFileResult is shared across modules and returns only url/fileName/size,
    // so the mime type is carried alongside it for the image-vs-video split.
    const files = (req.files || []).map((f) => ({ ...buildFileResult(f), mimeType: f.mimetype }));

    if (!files.length) {
        const { AppError } = require('../../middleware/errorHandler');
        throw new AppError('At least one image or video file is required', HTTP_STATUS.BAD_REQUEST);
    }

    const images = await imagesService.createImages(req.params.albumId, files, req.body);
    return sendSuccess(res, `${images.length} file(s) uploaded successfully`, { images }, HTTP_STATUS.CREATED);
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
