const leadershipService = require('../../services/about/leadership.service');
const transferService = require('../../services/about/transfer.service');
const { buildFileResult, deleteUploadedFile } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const { TEAM_TYPES, TEAM_TYPE_LABELS } = require('../../constants/teamTypes');
const asyncHandler = require('../../utils/asyncHandler');

const getAllLeadershipMembers = asyncHandler(async (req, res) => {
    const members = await leadershipService.getAllLeadershipMembers();
    return sendSuccess(res, 'Leadership team fetched successfully', { members });
});

const createLeadershipMember = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.file) {
        data.photo = buildFileResult(req.file);
    }

    const member = await leadershipService.createLeadershipMember(data);
    return sendSuccess(res, 'Leadership member created successfully', { member }, HTTP_STATUS.CREATED);
});

const updateLeadershipMember = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };

    if (req.file) {
        const existing = await leadershipService.getAllLeadershipMembers();
        const existingMember = existing.find((m) => m._id.toString() === id);
        if (existingMember && existingMember.photo && existingMember.photo.fileName) {
            await deleteUploadedFile(existingMember.photo.fileName);
        }
        data.photo = buildFileResult(req.file);
    }

    const member = await leadershipService.updateLeadershipMember(id, data);
    return sendSuccess(res, 'Leadership member updated successfully', { member });
});

const deleteLeadershipMember = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const member = await leadershipService.deleteLeadershipMember(id);

    if (member.photo && member.photo.fileName) {
        await deleteUploadedFile(member.photo.fileName);
    }

    return sendSuccess(res, 'Leadership member deleted successfully', {});
});

const toggleStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const member = await leadershipService.toggleLeadershipStatus(id);
    return sendSuccess(res, `Leadership member ${member.isActive ? 'activated' : 'deactivated'} successfully`, { member });
});

const reorderLeadershipMembers = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const members = await leadershipService.reorderLeadershipMembers(ids);
    return sendSuccess(res, 'Leadership team reordered successfully', { members });
});

const transferLeadershipMember = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { targetTeam } = req.body;

    const member = await transferService.transferMember(id, TEAM_TYPES.LEADERSHIP, targetTeam);

    return sendSuccess(
        res,
        `Leadership member moved to ${TEAM_TYPE_LABELS[targetTeam]} successfully`,
        { member, targetTeam }
    );
});

module.exports = {
    getAllLeadershipMembers,
    createLeadershipMember,
    updateLeadershipMember,
    deleteLeadershipMember,
    toggleStatus,
    reorderLeadershipMembers,
    transferLeadershipMember
};
