const path = require('path');
const fs = require('fs');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const legalService = require('../services/legalPage.service');
const { buildFileResult } = require('../services/upload.service');
const s3Client = require('../config/s3');
const env = require('../config/env');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// Multipart delivers everything as strings; displayOrder becomes a number and is
// dropped when blank so the service appends instead of writing NaN.
const normaliseBody = (body) => {
    const data = { ...body };
    if (data.displayOrder !== undefined && data.displayOrder !== '') data.displayOrder = Number(data.displayOrder);
    else delete data.displayOrder;
    return data;
};

const collectFiles = (req) => {
    const files = {};
    if (req.files && req.files.pdf) {
        const f = req.files.pdf[0];
        files.pdf = { ...buildFileResult(f), originalName: f.originalname };
    }
    return files;
};

// ── Public ─────────────────────────────────────────────────────────────────────

const listPublicPages = asyncHandler(async (req, res) => {
    const pages = await legalService.listPublicPages();
    return sendSuccess(res, 'Legal pages fetched successfully', { pages });
});

const getPublicPageBySlug = asyncHandler(async (req, res) => {
    const page = await legalService.getPublishedPageBySlug(req.params.slug);
    return sendSuccess(res, 'Legal page fetched successfully', { page });
});

// Serves the page's PDF. An uploaded file is streamed back with an attachment
// disposition (S3 in production is a different origin, so <a download> is
// ignored by the browser); an external link is redirected to.
const downloadPage = asyncHandler(async (req, res) => {
    const page = await legalService.getPublishedPageBySlug(req.params.slug);

    if (!page.pdf || (!page.pdf.fileName && !page.pdf.url)) {
        throw new AppError('No document is available for this page', HTTP_STATUS.NOT_FOUND);
    }

    // External link (no stored object): hand the browser straight to it.
    if (!page.pdf.fileName) {
        return res.redirect(page.pdf.url);
    }

    const safeName = (page.pdf.originalName || `${page.slug}.pdf`)
        .replace(/[^a-zA-Z0-9._ -]/g, '_')
        .slice(0, 120);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

    if (isS3) {
        const object = await s3Client.send(new GetObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: page.pdf.fileName
        }));
        if (object.ContentLength) res.setHeader('Content-Length', object.ContentLength);
        return object.Body.pipe(res);
    }

    // Local disk fallback. The stored url is "/uploads/<folder>/<file>", so the
    // path is rebuilt from it rather than trusting anything in the request.
    const relative = String(page.pdf.url || '').replace(/^\/uploads\//, '');
    const filePath = path.join(__dirname, '..', 'uploads', relative);
    const uploadsRoot = path.join(__dirname, '..', 'uploads');

    if (!filePath.startsWith(uploadsRoot) || !fs.existsSync(filePath)) {
        throw new AppError('Document file is unavailable', HTTP_STATUS.NOT_FOUND);
    }

    return fs.createReadStream(filePath).pipe(res);
});

// ── Admin ──────────────────────────────────────────────────────────────────────

const listPages = asyncHandler(async (req, res) => {
    const result = await legalService.listPages(req.query);
    return sendSuccess(res, 'Legal pages fetched successfully', result);
});

const getPageById = asyncHandler(async (req, res) => {
    const page = await legalService.getPageById(req.params.id);
    return sendSuccess(res, 'Legal page fetched successfully', { page });
});

const createPage = asyncHandler(async (req, res) => {
    const page = await legalService.createPage(normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Legal page created successfully', { page }, HTTP_STATUS.CREATED);
});

const updatePage = asyncHandler(async (req, res) => {
    const page = await legalService.updatePage(req.params.id, normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Legal page updated successfully', { page });
});

const deletePage = asyncHandler(async (req, res) => {
    await legalService.deletePage(req.params.id);
    return sendSuccess(res, 'Legal page deleted successfully', {});
});

const publishPage = asyncHandler(async (req, res) => {
    const page = await legalService.setPageStatus(req.params.id, 'Published');
    return sendSuccess(res, 'Legal page published successfully', { page });
});

const unpublishPage = asyncHandler(async (req, res) => {
    const page = await legalService.setPageStatus(req.params.id, 'Draft');
    return sendSuccess(res, 'Legal page moved to draft successfully', { page });
});

const reorderPages = asyncHandler(async (req, res) => {
    const pages = await legalService.reorderPages(req.body.ids);
    return sendSuccess(res, 'Legal pages reordered successfully', { pages });
});

module.exports = {
    listPublicPages,
    getPublicPageBySlug,
    downloadPage,
    listPages,
    getPageById,
    createPage,
    updatePage,
    deletePage,
    publishPage,
    unpublishPage,
    reorderPages
};
