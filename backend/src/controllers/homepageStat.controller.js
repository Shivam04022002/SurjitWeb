const statService = require('../services/homepageStat.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// displayOrder arrives as a string from the number input; drop it when blank so
// the service appends instead of writing NaN.
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

const listPublicStats = asyncHandler(async (req, res) => {
    const stats = await statService.listPublicStats();
    return sendSuccess(res, 'Homepage statistics fetched successfully', { stats });
});

// ── Admin ──────────────────────────────────────────────────────────────────────

const listStats = asyncHandler(async (req, res) => {
    const result = await statService.listStats(req.query);
    return sendSuccess(res, 'Homepage statistics fetched successfully', result);
});

const getStatById = asyncHandler(async (req, res) => {
    const stat = await statService.getStatById(req.params.id);
    return sendSuccess(res, 'Statistic fetched successfully', { stat });
});

const createStat = asyncHandler(async (req, res) => {
    const stat = await statService.createStat(normaliseBody(req.body));
    return sendSuccess(res, 'Statistic created successfully', { stat }, HTTP_STATUS.CREATED);
});

const updateStat = asyncHandler(async (req, res) => {
    const stat = await statService.updateStat(req.params.id, normaliseBody(req.body));
    return sendSuccess(res, 'Statistic updated successfully', { stat });
});

const deleteStat = asyncHandler(async (req, res) => {
    await statService.deleteStat(req.params.id);
    return sendSuccess(res, 'Statistic deleted successfully', {});
});

const publishStat = asyncHandler(async (req, res) => {
    const stat = await statService.setStatStatus(req.params.id, 'Published');
    return sendSuccess(res, 'Statistic published successfully', { stat });
});

const unpublishStat = asyncHandler(async (req, res) => {
    const stat = await statService.setStatStatus(req.params.id, 'Draft');
    return sendSuccess(res, 'Statistic moved to draft successfully', { stat });
});

const reorderStats = asyncHandler(async (req, res) => {
    const stats = await statService.reorderStats(req.body.ids);
    return sendSuccess(res, 'Statistics reordered successfully', { stats });
});

module.exports = {
    listPublicStats,
    listStats,
    getStatById,
    createStat,
    updateStat,
    deleteStat,
    publishStat,
    unpublishStat,
    reorderStats
};
