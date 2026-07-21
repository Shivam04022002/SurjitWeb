const Review = require('../models/Review');
const { AppError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('./upload.service');
const HTTP_STATUS = require('../constants/httpStatus');

// Fields the public site is allowed to see. Mobile and email are collected for
// verification only and must never leave the CMS.
const PUBLIC_FIELDS = 'customerName city productName rating review photo status displayOrder approvedAt createdAt';

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ customerName: rx }, { review: rx }, { productName: rx }, { city: rx }, { mobile: rx }];
    }

    if (filters.rating) query.rating = Number(filters.rating);

    return query;
};

// displayOrder first, then newest — so a moderator who never touches the order
// still gets the most recently approved reviews at the top.
const SORT = { displayOrder: 1, approvedAt: -1, createdAt: -1 };

// Approved only, public fields only. Backs the blog sidebar.
const listPublicReviews = async (filters = {}) => {
    const query = { status: 'Approved' };
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 3, 1), 50);

    if (!filters.page) {
        return Review.find(query).select(PUBLIC_FIELDS).sort(SORT).limit(limit);
    }

    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Review.find(query).select(PUBLIC_FIELDS).sort(SORT).skip(skip).limit(limit),
        Review.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

// Moderation queue. Pending first so new submissions surface without filtering.
const listReviews = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    const [data, total, pendingCount] = await Promise.all([
        Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Review.countDocuments(query),
        Review.countDocuments({ status: 'Pending' })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1, pendingCount };
};

const getReviewById = async (id) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    return review;
};

// Public submission. Status is forced here rather than taken from the request,
// so a crafted payload cannot self-approve.
const submitReview = async (data, photoFile) => {
    const payload = {
        customerName: data.customerName,
        mobile: data.mobile,
        email: data.email || '',
        city: data.city || '',
        productName: data.productName || '',
        rating: Number(data.rating),
        review: data.review,
        status: 'Pending',
        approvedAt: null,
        displayOrder: (await Review.countDocuments()) + 1
    };

    if (photoFile) payload.photo = photoFile;

    const review = await Review.create(payload);
    // Only the acknowledgement goes back — no ids or personal data.
    return { submitted: true, customerName: review.customerName };
};

const setReviewStatus = async (id, status) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    review.status = status;
    await review.save();
    return review;
};

const deleteReview = async (id) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

    if (review.photo && review.photo.fileName) {
        await deleteUploadedFile(review.photo.fileName);
    }

    await Review.findByIdAndDelete(id);
    return { deleted: true };
};

const reorderReviews = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await Review.bulkWrite(bulkOps);
    return Review.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listPublicReviews,
    listReviews,
    getReviewById,
    submitReview,
    setReviewStatus,
    deleteReview,
    reorderReviews
};
