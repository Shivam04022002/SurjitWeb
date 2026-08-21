const mongoose = require('mongoose');
const Review = require('../models/Review');
const Blog = require('../models/Blog');
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

// Approved only, public fields only, and always scoped to a single blog —
// the sidebar belongs to the article it sits beside.
//
// Fails closed: a request without a usable blog id returns nothing rather than
// every approved review. An unscoped fallback here is precisely what made one
// customer's review surface under every article, so a dropped parameter must
// produce an empty sidebar, never a global one.
const listPublicReviews = async (filters = {}) => {
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 3, 1), 50);

    if (!mongoose.Types.ObjectId.isValid(filters.blogId)) {
        const emptyPage = Math.max(parseInt(filters.page, 10) || 1, 1);
        return filters.page
            ? { data: [], total: 0, page: emptyPage, limit, totalPages: 1 }
            : [];
    }

    const query = { blog: filters.blogId, status: 'Approved' };

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

// Moderation queue. Pending first so new submissions surface without filtering,
// then displayOrder — the same order the public sidebar uses, so the sequence a
// moderator arranges here is the sequence a visitor actually sees. Sorting this
// list by createdAt instead is what made the two disagree: the reorder controls
// wrote displayOrder, and this list then re-sorted it away.
const listReviews = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = buildQuery(filters);

    // An aggregation rather than find().sort(): the Pending-first rule is a
    // computed rank, not a stored field. Blog is populated afterwards because
    // aggregate() bypasses Mongoose's ref handling.
    const listPipeline = [
        { $match: query },
        {
            $addFields: {
                statusRank: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$status', 'Pending'] }, then: 0 },
                            { case: { $eq: ['$status', 'Approved'] }, then: 1 }
                        ],
                        default: 2
                    }
                }
            }
        },
        { $sort: { statusRank: 1, displayOrder: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { statusRank: 0 } }
    ];

    const [data, total, pendingCount] = await Promise.all([
        Review.aggregate(listPipeline)
            .then((docs) => Review.populate(docs, { path: 'blog', select: 'title slug' })),
        Review.countDocuments(query),
        Review.countDocuments({ status: 'Pending' })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1, pendingCount };
};

const getReviewById = async (id) => {
    const review = await Review.findById(id).populate('blog', 'title slug');
    if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
    return review;
};

// Mirrors assertCategoryExists in blogs.service: the id is already known to be
// well-formed by the validator, so what is left is proving it points at a real,
// published article. Rejecting here keeps orphan reviews out of the collection.
const assertBlogExists = async (blogId) => {
    const blog = await Blog.findOne({ _id: blogId, status: 'published' }).select('_id');
    if (!blog) throw new AppError('Selected blog does not exist', HTTP_STATUS.BAD_REQUEST);
    return blog._id;
};

// Public submission. Status is forced here rather than taken from the request,
// so a crafted payload cannot self-approve. The same applies to the blog: it is
// read from the validated blogId only, so nothing else in the body can steer it.
const submitReview = async (data, photoFile) => {
    const blogId = await assertBlogExists(data.blogId);

    const payload = {
        blog: blogId,
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

// Reorders within the positions these reviews already occupy, rather than
// renumbering from 1. The CMS sends a single page at a time, so numbering from
// 1 would hand page 2 the same displayOrder values page 1 already holds and
// scramble the public order. Permuting a set among its own slots cannot
// collide with anything outside it.
const reorderReviews = async (orderedIds) => {
    const existing = await Review.find({ _id: { $in: orderedIds } }).select('displayOrder');
    if (existing.length !== orderedIds.length) {
        throw new AppError('One or more reviews no longer exist', HTTP_STATUS.BAD_REQUEST);
    }

    const slots = existing.map((r) => r.displayOrder).sort((a, b) => a - b);

    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { displayOrder: slots[index] } } }
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
