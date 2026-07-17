const albumsService = require('../../services/gallery/albums.service');
const { buildFileResult } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllAlbums = asyncHandler(async (req, res) => {
    const { isActive, search } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    const albums = await albumsService.getAllAlbums(filters);
    return sendSuccess(res, 'Albums fetched successfully', { albums });
});

const getAlbumById = asyncHandler(async (req, res) => {
    const album = await albumsService.getAlbumById(req.params.id);
    return sendSuccess(res, 'Album fetched successfully', { album });
});

const createAlbum = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    let coverImageFile = null;

    if (req.file) {
        coverImageFile = buildFileResult(req.file);
    }

    const album = await albumsService.createAlbum(data, coverImageFile);
    return sendSuccess(res, 'Album created successfully', { album }, HTTP_STATUS.CREATED);
});

const updateAlbum = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    let coverImageFile = null;

    if (req.file) {
        coverImageFile = buildFileResult(req.file);
    }

    const album = await albumsService.updateAlbum(req.params.id, data, coverImageFile);
    return sendSuccess(res, 'Album updated successfully', { album });
});

const deleteAlbum = asyncHandler(async (req, res) => {
    await albumsService.deleteAlbum(req.params.id);
    return sendSuccess(res, 'Album deleted successfully', {});
});

const toggleAlbumStatus = asyncHandler(async (req, res) => {
    const album = await albumsService.toggleAlbumStatus(req.params.id);
    return sendSuccess(res, `Album ${album.isActive ? 'activated' : 'deactivated'} successfully`, { album });
});

const reorderAlbums = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const albums = await albumsService.reorderAlbums(ids);
    return sendSuccess(res, 'Albums reordered successfully', { albums });
});

module.exports = {
    getAllAlbums,
    getAlbumById,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    toggleAlbumStatus,
    reorderAlbums
};
