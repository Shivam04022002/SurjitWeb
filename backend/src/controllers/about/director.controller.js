const directorService = require('../../services/about/director.service');
const transferService = require('../../services/about/transfer.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const { TEAM_TYPES, TEAM_TYPE_LABELS } = require('../../constants/teamTypes');
const asyncHandler = require('../../utils/asyncHandler');

const getAllDirectors = asyncHandler(async (req, res) => {
    const directors = await directorService.getAllDirectors();
    return sendSuccess(res, 'Directors fetched successfully', { directors });
});

const createDirector = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.file) {
        data.photo = buildFileResult(req.file);
    }

    const director = await directorService.createDirector(data);
    return sendSuccess(res, 'Director created successfully', { director }, HTTP_STATUS.CREATED);
});

const updateDirector = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };

    if (req.file) {
        const existing = await directorService.getAllDirectors();
        const existingDirector = existing.find((d) => d._id.toString() === id);
        if (existingDirector && existingDirector.photo && existingDirector.photo.fileName) {
            await deleteUploadedFile(existingDirector.photo.fileName);
        }
        data.photo = buildFileResult(req.file);
    }

    const director = await directorService.updateDirector(id, data);
    return sendSuccess(res, 'Director updated successfully', { director });
});

const deleteDirector = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const director = await directorService.deleteDirector(id);

    if (director.photo && director.photo.fileName) {
        await deleteUploadedFile(director.photo.fileName);
    }

    return sendSuccess(res, 'Director deleted successfully', {});
});

const toggleStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const director = await directorService.toggleDirectorStatus(id);
    return sendSuccess(res, `Director ${director.isActive ? 'activated' : 'deactivated'} successfully`, { director });
});

const reorderDirectors = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const directors = await directorService.reorderDirectors(ids);
    return sendSuccess(res, 'Directors reordered successfully', { directors });
});

const transferDirector = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { targetTeam } = req.body;

    const member = await transferService.transferMember(id, TEAM_TYPES.BOARD, targetTeam);

    return sendSuccess(
        res,
        `Director moved to ${TEAM_TYPE_LABELS[targetTeam]} successfully`,
        { member, targetTeam }
    );
});

module.exports = {
    getAllDirectors,
    createDirector,
    updateDirector,
    deleteDirector,
    toggleStatus,
    reorderDirectors,
    transferDirector
};
