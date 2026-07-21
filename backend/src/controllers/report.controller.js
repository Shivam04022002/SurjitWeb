const path = require('path');
const fs = require('fs');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const reportService = require('../services/report.service');
const { buildFileResult } = require('../services/upload.service');
const s3Client = require('../config/s3');
const env = require('../config/env');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');

// Multipart delivers everything as strings; these come back as real types.
const normaliseBody = (body) => {
    const data = { ...body };
    if (data.year !== undefined && data.year !== '') data.year = Number(data.year);
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
    if (req.files && req.files.thumbnail) {
        files.thumbnail = buildFileResult(req.files.thumbnail[0]);
    }
    return files;
};

// ── Public ─────────────────────────────────────────────────────────────────────

const listPublicReports = asyncHandler(async (req, res) => {
    const reports = await reportService.listPublicReports();
    return sendSuccess(res, 'Reports fetched successfully', { reports });
});

// Streams the PDF back with an attachment disposition. The stored file lives on
// S3 in production, which is a different origin, so an <a download> on the
// client is ignored by the browser — proxying here is what actually makes
// "Download" save the file rather than open it.
const downloadReport = asyncHandler(async (req, res) => {
    const report = await reportService.getPublishedReportById(req.params.id);

    const safeName = (report.pdf.originalName || `${report.title}.pdf`)
        .replace(/[^a-zA-Z0-9._ -]/g, '_')
        .slice(0, 120);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

    if (isS3) {
        const object = await s3Client.send(new GetObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: report.pdf.fileName
        }));
        if (object.ContentLength) res.setHeader('Content-Length', object.ContentLength);
        return object.Body.pipe(res);
    }

    // Local disk fallback. The stored url is "/uploads/<folder>/<file>", so the
    // path is rebuilt from it rather than trusting anything in the request.
    const relative = String(report.pdf.url || '').replace(/^\/uploads\//, '');
    const filePath = path.join(__dirname, '..', 'uploads', relative);
    const uploadsRoot = path.join(__dirname, '..', 'uploads');

    if (!filePath.startsWith(uploadsRoot) || !fs.existsSync(filePath)) {
        throw new AppError('Report file is unavailable', HTTP_STATUS.NOT_FOUND);
    }

    return fs.createReadStream(filePath).pipe(res);
});

// ── Admin ──────────────────────────────────────────────────────────────────────

const listReports = asyncHandler(async (req, res) => {
    const result = await reportService.listReports(req.query);
    return sendSuccess(res, 'Reports fetched successfully', result);
});

const getReportById = asyncHandler(async (req, res) => {
    const report = await reportService.getReportById(req.params.id);
    return sendSuccess(res, 'Report fetched successfully', { report });
});

const createReport = asyncHandler(async (req, res) => {
    const report = await reportService.createReport(normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Report uploaded successfully', { report }, HTTP_STATUS.CREATED);
});

const updateReport = asyncHandler(async (req, res) => {
    const report = await reportService.updateReport(req.params.id, normaliseBody(req.body), collectFiles(req));
    return sendSuccess(res, 'Report updated successfully', { report });
});

const deleteReport = asyncHandler(async (req, res) => {
    await reportService.deleteReport(req.params.id);
    return sendSuccess(res, 'Report deleted successfully', {});
});

const publishReport = asyncHandler(async (req, res) => {
    const report = await reportService.setReportStatus(req.params.id, 'Published');
    return sendSuccess(res, 'Report published successfully', { report });
});

const unpublishReport = asyncHandler(async (req, res) => {
    const report = await reportService.setReportStatus(req.params.id, 'Draft');
    return sendSuccess(res, 'Report moved to draft successfully', { report });
});

const reorderReports = asyncHandler(async (req, res) => {
    const reports = await reportService.reorderReports(req.body.ids);
    return sendSuccess(res, 'Reports reordered successfully', { reports });
});

module.exports = {
    listPublicReports,
    downloadReport,
    listReports,
    getReportById,
    createReport,
    updateReport,
    deleteReport,
    publishReport,
    unpublishReport,
    reorderReports
};
