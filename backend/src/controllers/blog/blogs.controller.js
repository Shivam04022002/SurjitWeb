const blogsService = require('../../services/blog/blogs.service');
const { buildFileResult } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

// Multipart sends everything as strings; these come back as real types.
const normaliseBody = (body) => {
    const data = { ...body };

    if (typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (data.readingTime !== undefined && data.readingTime !== '') {
        data.readingTime = Number(data.readingTime);
    } else {
        delete data.readingTime;
    }
    if (data.category === '' || data.category === 'null') data.category = null;

    // SEO arrives either nested (JSON body) or flattened as seo.metaTitle
    // (multipart), so both shapes are folded into one object.
    const seo = { ...(data.seo || {}) };
    ['metaTitle', 'metaDescription', 'metaKeywords'].forEach((k) => {
        if (data[`seo.${k}`] !== undefined) {
            seo[k] = data[`seo.${k}`];
            delete data[`seo.${k}`];
        }
    });
    if (Object.keys(seo).length) data.seo = seo;

    return data;
};

const collectFiles = (req) => {
    const files = {};
    if (req.files && req.files.featuredImage) files.featuredImage = buildFileResult(req.files.featuredImage[0]);
    if (req.files && req.files['seo.ogImage']) files.ogImage = buildFileResult(req.files['seo.ogImage'][0]);
    if (req.files && req.files.ogImage) files.ogImage = buildFileResult(req.files.ogImage[0]);
    return files;
};

const listBlogs = asyncHandler(async (req, res) => {
    const result = await blogsService.listBlogs(req.query);
    return sendSuccess(res, 'Blogs fetched successfully', result);
});

const getBlogById = asyncHandler(async (req, res) => {
    const blog = await blogsService.getBlogById(req.params.id);
    return sendSuccess(res, 'Blog fetched successfully', { blog });
});

const createBlog = asyncHandler(async (req, res) => {
    const blog = await blogsService.createBlog(normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Blog created successfully', { blog }, HTTP_STATUS.CREATED);
});

const updateBlog = asyncHandler(async (req, res) => {
    const blog = await blogsService.updateBlog(req.params.id, normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Blog updated successfully', { blog });
});

const deleteBlog = asyncHandler(async (req, res) => {
    await blogsService.deleteBlog(req.params.id);
    return sendSuccess(res, 'Blog deleted successfully', {});
});

const publishBlog = asyncHandler(async (req, res) => {
    const blog = await blogsService.setBlogStatus(req.params.id, 'published');
    return sendSuccess(res, 'Blog published successfully', { blog });
});

const unpublishBlog = asyncHandler(async (req, res) => {
    const blog = await blogsService.setBlogStatus(req.params.id, 'draft');
    return sendSuccess(res, 'Blog moved to draft successfully', { blog });
});

const duplicateBlog = asyncHandler(async (req, res) => {
    const blog = await blogsService.duplicateBlog(req.params.id);
    return sendSuccess(res, 'Blog duplicated successfully', { blog }, HTTP_STATUS.CREATED);
});

module.exports = {
    listBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    publishBlog,
    unpublishBlog,
    duplicateBlog
};
