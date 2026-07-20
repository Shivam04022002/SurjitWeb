const reviewService = require('../services/review.service');
const { buildFileResult } = require('../services/upload.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// Multipart delivers everything as strings; these come back as real types.
const normaliseBody = (body) => {
    const data = { ...body };
    if (data.rating !== undefined && data.rating !== '') data.rating = Number(data.rating);
    if (data.displayOrder !== undefined && data.displayOrder !== '') data.displayOrder = Number(data.displayOrder);
    else delete data.displayOrder;
    if (data.isPublished !== undefined) data.isPublished = data.isPublished === 'true' || data.isPublished === true;
    return data;
};

const listReviews = asyncHandler(async (req, res) => {
    const filters = { ...req.query };
    if (filters.isPublished !== undefined) filters.isPublished = filters.isPublished === 'true';
    const result = await reviewService.listReviews(filters);
    return sendSuccess(res, 'Reviews fetched successfully', result);
});

const getReviewById = asyncHandler(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.id);
    return sendSuccess(res, 'Review fetched successfully', { review });
});

const createReview = asyncHandler(async (req, res) => {
    const image = req.file ? buildFileResult(req.file) : null;
    const review = await reviewService.createReview(normaliseBody(req.body), image);
    return sendSuccess(res, 'Review created successfully', { review }, HTTP_STATUS.CREATED);
});

const updateReview = asyncHandler(async (req, res) => {
    const image = req.file ? buildFileResult(req.file) : null;
    const review = await reviewService.updateReview(req.params.id, normaliseBody(req.body), image);
    return sendSuccess(res, 'Review updated successfully', { review });
});

const deleteReview = asyncHandler(async (req, res) => {
    await reviewService.deleteReview(req.params.id);
    return sendSuccess(res, 'Review deleted successfully', {});
});

const toggleReviewStatus = asyncHandler(async (req, res) => {
    const review = await reviewService.toggleReviewStatus(req.params.id);
    return sendSuccess(res, `Review ${review.isPublished ? 'published' : 'unpublished'} successfully`, { review });
});

const reorderReviews = asyncHandler(async (req, res) => {
    const reviews = await reviewService.reorderReviews(req.body.ids);
    return sendSuccess(res, 'Reviews reordered successfully', { reviews });
});

module.exports = {
    listReviews,
    getReviewById,
    createReview,
    updateReview,
    deleteReview,
    toggleReviewStatus,
    reorderReviews
};
