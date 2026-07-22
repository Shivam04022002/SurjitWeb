const branchService = require('../services/branch.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// The CMS posts JSON, but displayOrder still arrives as a string from the
// number input when it is left blank; drop it so the service can append.
const normaliseBody = (body) => {
    const data = { ...body };
    if (data.displayOrder !== undefined && data.displayOrder !== '') {
        data.displayOrder = Number(data.displayOrder);
    } else {
        delete data.displayOrder;
    }
    return data;
};

// ── Public ─────────────────────────────────────────────────────────────────────

const listPublicBranches = asyncHandler(async (req, res) => {
    const branches = await branchService.listPublicBranches();
    return sendSuccess(res, 'Branches fetched successfully', { branches });
});

// ── Admin ──────────────────────────────────────────────────────────────────────

const listBranches = asyncHandler(async (req, res) => {
    const result = await branchService.listBranches(req.query);
    return sendSuccess(res, 'Branches fetched successfully', result);
});

const getBranchById = asyncHandler(async (req, res) => {
    const branch = await branchService.getBranchById(req.params.id);
    return sendSuccess(res, 'Branch fetched successfully', { branch });
});

const createBranch = asyncHandler(async (req, res) => {
    const branch = await branchService.createBranch(normaliseBody(req.body));
    return sendSuccess(res, 'Branch created successfully', { branch }, HTTP_STATUS.CREATED);
});

const updateBranch = asyncHandler(async (req, res) => {
    const branch = await branchService.updateBranch(req.params.id, normaliseBody(req.body));
    return sendSuccess(res, 'Branch updated successfully', { branch });
});

const deleteBranch = asyncHandler(async (req, res) => {
    await branchService.deleteBranch(req.params.id);
    return sendSuccess(res, 'Branch deleted successfully', {});
});

const publishBranch = asyncHandler(async (req, res) => {
    const branch = await branchService.setBranchStatus(req.params.id, 'Published');
    return sendSuccess(res, 'Branch published successfully', { branch });
});

const unpublishBranch = asyncHandler(async (req, res) => {
    const branch = await branchService.setBranchStatus(req.params.id, 'Draft');
    return sendSuccess(res, 'Branch moved to draft successfully', { branch });
});

const reorderBranches = asyncHandler(async (req, res) => {
    const branches = await branchService.reorderBranches(req.body.ids);
    return sendSuccess(res, 'Branches reordered successfully', { branches });
});

module.exports = {
    listPublicBranches,
    listBranches,
    getBranchById,
    createBranch,
    updateBranch,
    deleteBranch,
    publishBranch,
    unpublishBranch,
    reorderBranches
};
