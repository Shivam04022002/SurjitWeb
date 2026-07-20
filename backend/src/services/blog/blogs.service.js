const Blog = require('../../models/Blog');
const BlogCategory = require('../../models/BlogCategory');
const { AppError } = require('../../middleware/errorHandler');
const { deleteUploadedFile } = require('../upload.service');
const HTTP_STATUS = require('../../constants/httpStatus');

// Shared between the CMS list and the public listing. Search covers title,
// summary, author and tags; the regex form is used rather than $text so
// partial words match the way an editor expects while typing.
const buildQuery = (filters = {}) => {
    const query = {};

    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;

    if (filters.search) {
        const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ title: rx }, { summary: rx }, { author: rx }, { tags: rx }];
    }

    if (filters.dateFrom || filters.dateTo) {
        query.publishedAt = {};
        if (filters.dateFrom) query.publishedAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.publishedAt.$lte = new Date(filters.dateTo);
    }

    return query;
};

const SORTABLE = ['createdAt', 'updatedAt', 'publishedAt', 'title'];

const listBlogs = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const sortBy = SORTABLE.includes(filters.sortBy) ? filters.sortBy : 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

    const query = buildQuery(filters);

    const [data, total] = await Promise.all([
        Blog.find(query)
            .populate('category', 'name slug')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit),
        Blog.countDocuments(query)
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
};

const getBlogById = async (id) => {
    const blog = await Blog.findById(id).populate('category', 'name slug');
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    return blog;
};

const getPublishedBlogBySlug = async (slug) => {
    const blog = await Blog.findOne({ slug, status: 'published' }).populate('category', 'name slug');
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    return blog;
};

// Same category, published, excluding the post being read. Falls back to the
// most recent posts so the section is never empty on a lone-category blog.
const getRelatedBlogs = async (slug, limit = 3) => {
    const blog = await Blog.findOne({ slug, status: 'published' });
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);

    const base = { status: 'published', _id: { $ne: blog._id } };
    let related = [];

    if (blog.category) {
        related = await Blog.find({ ...base, category: blog.category })
            .populate('category', 'name slug')
            .sort({ publishedAt: -1 })
            .limit(limit);
    }

    if (related.length < limit) {
        const fill = await Blog.find({ ...base, _id: { $nin: [blog._id, ...related.map((r) => r._id)] } })
            .populate('category', 'name slug')
            .sort({ publishedAt: -1 })
            .limit(limit - related.length);
        related = [...related, ...fill];
    }

    return related;
};

// Ordered by publish date, so "previous" is the older post either side of this
// one — the order a reader moving through the archive expects.
const getAdjacentBlogs = async (slug) => {
    const blog = await Blog.findOne({ slug, status: 'published' });
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);

    const pivot = blog.publishedAt || blog.createdAt;

    const [previous, next] = await Promise.all([
        Blog.findOne({ status: 'published', publishedAt: { $lt: pivot } })
            .sort({ publishedAt: -1 }).select('title slug featuredImage'),
        Blog.findOne({ status: 'published', publishedAt: { $gt: pivot } })
            .sort({ publishedAt: 1 }).select('title slug featuredImage')
    ]);

    return { previous, next };
};

const slugExists = async (slug, excludeId = null) => {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    return !!(await Blog.findOne(query));
};

const assertCategoryExists = async (categoryId) => {
    if (!categoryId) return;
    const exists = await BlogCategory.findById(categoryId);
    if (!exists) throw new AppError('Selected blog category does not exist', HTTP_STATUS.BAD_REQUEST);
};

const createBlog = async (data, files = {}) => {
    if (await slugExists(data.slug)) {
        throw new AppError('A blog with this slug already exists', HTTP_STATUS.CONFLICT);
    }
    await assertCategoryExists(data.category);

    if (files.featuredImage) data.featuredImage = files.featuredImage;
    if (files.ogImage) data.seo = { ...(data.seo || {}), ogImage: files.ogImage };

    return Blog.create(data);
};

const updateBlog = async (id, data, files = {}) => {
    const blog = await Blog.findById(id);
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);

    if (data.slug && data.slug !== blog.slug && await slugExists(data.slug, id)) {
        throw new AppError('A blog with this slug already exists', HTTP_STATUS.CONFLICT);
    }
    if (data.category !== undefined) await assertCategoryExists(data.category);

    if (files.featuredImage) {
        if (blog.featuredImage && blog.featuredImage.fileName) {
            await deleteUploadedFile(blog.featuredImage.fileName);
        }
        data.featuredImage = files.featuredImage;
    }
    if (files.ogImage) {
        if (blog.seo && blog.seo.ogImage && blog.seo.ogImage.fileName) {
            await deleteUploadedFile(blog.seo.ogImage.fileName);
        }
        data.seo = { ...(blog.seo ? blog.seo.toObject() : {}), ...(data.seo || {}), ogImage: files.ogImage };
    }

    // Re-derive on a content change unless the editor set it explicitly.
    if (data.content && data.readingTime === undefined) blog.readingTime = 0;

    Object.assign(blog, data);
    await blog.save();
    return Blog.findById(id).populate('category', 'name slug');
};

const deleteBlog = async (id) => {
    const blog = await Blog.findById(id);
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);

    if (blog.featuredImage && blog.featuredImage.fileName) {
        await deleteUploadedFile(blog.featuredImage.fileName);
    }
    if (blog.seo && blog.seo.ogImage && blog.seo.ogImage.fileName) {
        await deleteUploadedFile(blog.seo.ogImage.fileName);
    }

    await Blog.findByIdAndDelete(id);
    return { deleted: true };
};

const setBlogStatus = async (id, status) => {
    const blog = await Blog.findById(id);
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);
    blog.status = status;
    await blog.save();
    return Blog.findById(id).populate('category', 'name slug');
};

// Copies a post as a fresh draft. The slug gets a suffix so the unique index
// holds, and the publish date is dropped.
const duplicateBlog = async (id) => {
    const blog = await Blog.findById(id);
    if (!blog) throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND);

    const source = blog.toObject();
    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.__v;

    let slug = `${blog.slug}-copy`;
    let n = 2;
    while (await slugExists(slug)) slug = `${blog.slug}-copy-${n++}`;

    return Blog.create({
        ...source,
        title: `${blog.title} (Copy)`,
        slug,
        status: 'draft',
        publishedAt: null
    });
};

module.exports = {
    listBlogs,
    getBlogById,
    getPublishedBlogBySlug,
    getRelatedBlogs,
    getAdjacentBlogs,
    createBlog,
    updateBlog,
    deleteBlog,
    setBlogStatus,
    duplicateBlog
};
