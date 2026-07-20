const Review = require('../models/Review');
const { AppError } = require('../middleware/errorHandler');
const { deleteUploadedFile } = require('./upload.service');
const HTTP_STATUS = require('../constants/httpStatus');

const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.isPublished !== undefined) query.isPublished = filters.isPublished;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ customerName: rx }, { review: rx }, { productName: rx }, { location: rx }];
    }

    if (filters.rating) query.rating = Number(filters.rating);

    return query;
};

// displayOrder first, then newest — so an admin who leaves the order alone
// still gets the most recent reviews at the top.
const SORT = { displayOrder: 1, createdAt: -1 };

const listReviews = async (filters = {}) => {
    const query = buildQuery(filters);

    if (filters.limit && !filters.page) {
        return Review.find(query).sort(SORT).limit(Math.min(Number(filters.limit), 50));
    }

    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Review.find(query).sort(SORT).skip(skip).limit(limit),
        Review.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getReviewById = async (id) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    return review;
};

const createReview = async (data, imageFile) => {
    if (data.displayOrder === undefined || data.displayOrder === null || data.displayOrder === '') {
        data.displayOrder = (await Review.countDocuments()) + 1;
    }
    if (imageFile) data.customerImage = imageFile;
    return Review.create(data);
};

const updateReview = async (id, data, imageFile) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

    if (imageFile) {
        if (review.customerImage && review.customerImage.fileName) {
            await deleteUploadedFile(review.customerImage.fileName);
        }
        data.customerImage = imageFile;
    }

    Object.assign(review, data);
    await review.save();
    return review;
};

const deleteReview = async (id) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

    if (review.customerImage && review.customerImage.fileName) {
        await deleteUploadedFile(review.customerImage.fileName);
    }

    await Review.findByIdAndDelete(id);
    return { deleted: true };
};

const toggleReviewStatus = async (id) => {
    const review = await Review.findById(id);
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    review.isPublished = !review.isPublished;
    await review.save();
    return review;
};

const reorderReviews = async (orderedIds) => {
    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: index + 1 } } }
    }));
    await Review.bulkWrite(bulkOps);
    return Review.find({ _id: { $in: orderedIds } }).sort(SORT);
};

module.exports = {
    listReviews,
    getReviewById,
    createReview,
    updateReview,
    deleteReview,
    toggleReviewStatus,
    reorderReviews
};
