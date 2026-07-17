const applicationsService = require('../../services/career/applications.service');
const { buildFileResult } = require('../../services/upload.service');
const { sendSuccess } = require('../../utils/response');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');

const getAllApplications = asyncHandler(async (req, res) => {
    const { status, appliedPosition, search } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (appliedPosition) filters.appliedPosition = appliedPosition;
    if (search) filters.search = search;

    const applications = await applicationsService.getAllApplications(filters);
    return sendSuccess(res, 'Applications fetched successfully', { applications });
});

const getApplicationById = asyncHandler(async (req, res) => {
    const application = await applicationsService.getApplicationById(req.params.id);
    return sendSuccess(res, 'Application fetched successfully', { application });
});

const submitApplication = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    if (req.file) {
        const isS3 = !!(process.env.AWS_S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID);
        data.resumeUrl = isS3 ? req.file.location : `/uploads/resumes/${req.file.filename}`;
        data.resumeFileName = req.file.key || req.file.filename || '';
    }

    const application = await applicationsService.createApplication(data);
    return sendSuccess(res, 'Application submitted successfully! We will contact you soon.', { application }, HTTP_STATUS.CREATED);
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const application = await applicationsService.updateApplicationStatus(req.params.id, status);
    return sendSuccess(res, 'Application status updated successfully', { application });
});

const deleteApplication = asyncHandler(async (req, res) => {
    await applicationsService.deleteApplication(req.params.id);
    return sendSuccess(res, 'Application deleted successfully', {});
});

const exportApplications = asyncHandler(async (req, res) => {
    const { status, appliedPosition } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (appliedPosition) filters.appliedPosition = appliedPosition;

    const applications = await applicationsService.exportApplications(filters);

    const fields = ['applicantName', 'email', 'phone', 'appliedPositionTitle', 'status', 'resumeUrl', 'createdAt'];
    const header = fields.join(',');
    const rows = applications.map((app) =>
        fields.map((f) => {
            const val = f === 'createdAt' ? new Date(app[f]).toISOString() : (app[f] || '');
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
    return res.status(HTTP_STATUS.OK).send(csv);
});

module.exports = {
    getAllApplications,
    getApplicationById,
    submitApplication,
    updateApplicationStatus,
    deleteApplication,
    exportApplications
};
