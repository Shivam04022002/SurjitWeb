const reviewService = require('../services/review.service');
const { buildFileResult } = require('../services/upload.service');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// ── Public ─────────────────────────────────────────────────────────────────────

const listPublicReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.listPublicReviews(req.query);
    const payload = Array.isArray(result) ? { reviews: result } : { ...result, reviews: result.data };
    return sendSuccess(res, 'Reviews fetched successfully', payload);
});

// Anyone can post; the service forces status to Pending, so nothing here is
// trusted from the client beyond the validated fields.
const submitReview = asyncHandler(async (req, res) => {
    const photo = req.file ? buildFileResult(req.file) : null;
    await reviewService.submitReview(req.body, photo);
    return sendSuccess(
        res,
        'Thank you for your feedback. Your review will be published after verification.',
        {},
        HTTP_STATUS.CREATED
    );
});

// ── Moderation (admin) ─────────────────────────────────────────────────────────

const listReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.listReviews(req.query);
    return sendSuccess(res, 'Reviews fetched successfully', result);
});

const getReviewById = asyncHandler(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.id);
    return sendSuccess(res, 'Review fetched successfully', { review });
});

const approveReview = asyncHandler(async (req, res) => {
    const review = await reviewService.setReviewStatus(req.params.id, 'Approved');
    return sendSuccess(res, 'Review approved', { review });
});

const rejectReview = asyncHandler(async (req, res) => {
    const review = await reviewService.setReviewStatus(req.params.id, 'Rejected');
    return sendSuccess(res, 'Review rejected', { review });
});

const deleteReview = asyncHandler(async (req, res) => {
    await reviewService.deleteReview(req.params.id);
    return sendSuccess(res, 'Review deleted successfully', {});
});

const reorderReviews = asyncHandler(async (req, res) => {
    const reviews = await reviewService.reorderReviews(req.body.ids);
    return sendSuccess(res, 'Reviews reordered successfully', { reviews });
});

module.exports = {
    listPublicReviews,
    submitReview,
    listReviews,
    getReviewById,
    approveReview,
    rejectReview,
    deleteReview,
    reorderReviews
};
