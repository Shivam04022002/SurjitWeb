const nodalOfficerService = require('../services/nodalOfficer.service');
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

const listPublicOfficers = asyncHandler(async (req, res) => {
    const officers = await nodalOfficerService.listPublicOfficers();
    return sendSuccess(res, 'Nodal officers fetched successfully', { officers });
});

// ── Admin ──────────────────────────────────────────────────────────────────────

const listOfficers = asyncHandler(async (req, res) => {
    const result = await nodalOfficerService.listOfficers(req.query);
    return sendSuccess(res, 'Nodal officers fetched successfully', result);
});

const getOfficerById = asyncHandler(async (req, res) => {
    const officer = await nodalOfficerService.getOfficerById(req.params.id);
    return sendSuccess(res, 'Nodal officer fetched successfully', { officer });
});

const createOfficer = asyncHandler(async (req, res) => {
    const officer = await nodalOfficerService.createOfficer(normaliseBody(req.body));
    return sendSuccess(res, 'Nodal officer created successfully', { officer }, HTTP_STATUS.CREATED);
});

const updateOfficer = asyncHandler(async (req, res) => {
    const officer = await nodalOfficerService.updateOfficer(req.params.id, normaliseBody(req.body));
    return sendSuccess(res, 'Nodal officer updated successfully', { officer });
});

const deleteOfficer = asyncHandler(async (req, res) => {
    await nodalOfficerService.deleteOfficer(req.params.id);
    return sendSuccess(res, 'Nodal officer deleted successfully', {});
});

const publishOfficer = asyncHandler(async (req, res) => {
    const officer = await nodalOfficerService.setOfficerStatus(req.params.id, 'Published');
    return sendSuccess(res, 'Nodal officer published successfully', { officer });
});

const unpublishOfficer = asyncHandler(async (req, res) => {
    const officer = await nodalOfficerService.setOfficerStatus(req.params.id, 'Draft');
    return sendSuccess(res, 'Nodal officer moved to draft successfully', { officer });
});

const reorderOfficers = asyncHandler(async (req, res) => {
    const officers = await nodalOfficerService.reorderOfficers(req.body.ids);
    return sendSuccess(res, 'Nodal officers reordered successfully', { officers });
});

module.exports = {
    listPublicOfficers,
    listOfficers,
    getOfficerById,
    createOfficer,
    updateOfficer,
    deleteOfficer,
    publishOfficer,
    unpublishOfficer,
    reorderOfficers
};
