const mongoose = require('mongoose');
const applicationsService = require('../../services/career/applications.service');
const JobApplication = require('../../models/JobApplication');
const { resumeViewOf, openResume } = require('../../services/career/resumes');
const { originalNameOf, sendOpenedFile } = require('../../services/storage/privateFiles');
const { sendSuccess } = require('../../utils/response');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

// Fields a public applicant may supply. Everything else on the record —
// status, the CV's storage address, deletedAt, timestamps — is set by the
// server, so a crafted submission cannot point its application at someone
// else's CV or mark itself shortlisted.
const APPLICANT_FIELDS = ['applicantName', 'email', 'phone', 'appliedPositionTitle', 'coverLetter'];

// An application as the CMS receives it: everything except where its CV is
// stored, which is replaced by a description of the CV. The file itself is
// served by downloadResume below.
const adminViewOf = async (application, { check = false } = {}) => {
    if (!application) return application;
    const body = typeof application.toObject === 'function' ? application.toObject() : { ...application };
    const resume = await resumeViewOf(application, { check });
    delete body.resumeUrl;
    delete body.resumeFileName;
    delete body.resumeOriginalName;
    return { ...body, resume };
};

const getAllApplications = asyncHandler(async (req, res) => {
    const { status, appliedPosition, search } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (appliedPosition) filters.appliedPosition = appliedPosition;
    if (search) filters.search = search;

    const applications = await applicationsService.getAllApplications(filters);
    const views = await Promise.all(applications.map((a) => adminViewOf(a)));
    return sendSuccess(res, 'Applications fetched successfully', { applications: views });
});

// The detail view also asks storage whether the CV is still there.
const getApplicationById = asyncHandler(async (req, res) => {
    const application = await applicationsService.getApplicationById(req.params.id);
    return sendSuccess(res, 'Application fetched successfully', { application: await adminViewOf(application, { check: true }) });
});

const submitApplication = asyncHandler(async (req, res) => {
    const data = {};
    APPLICANT_FIELDS.forEach((field) => {
        if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    if (req.file) {
        const isS3 = !!(process.env.AWS_S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID);
        data.resumeUrl = isS3 ? req.file.location : `/uploads/resumes/${req.file.filename}`;
        data.resumeFileName = req.file.key || req.file.filename || '';
        data.resumeOriginalName = originalNameOf(req.file);
    }

    await applicationsService.createApplication(data);
    // Only the acknowledgement: the stored record (and where the CV is kept)
    // is never echoed to a public client.
    return sendSuccess(res, 'Application submitted successfully! We will contact you soon.', {}, HTTP_STATUS.CREATED);
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const application = await applicationsService.updateApplicationStatus(req.params.id, status);
    return sendSuccess(res, 'Application status updated successfully', { application: await adminViewOf(application) });
});

const deleteApplication = asyncHandler(async (req, res) => {
    await applicationsService.deleteApplication(req.params.id);
    return sendSuccess(res, 'Application deleted successfully', {});
});

// CSV columns. "resume" says whether a CV is attached; its storage address is
// not exported — a spreadsheet travels further than the CMS does.
const EXPORT_FIELDS = ['applicantName', 'email', 'phone', 'appliedPositionTitle', 'status', 'resume', 'createdAt'];

const exportApplications = asyncHandler(async (req, res) => {
    const { status, appliedPosition } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (appliedPosition) filters.appliedPosition = appliedPosition;

    const applications = await applicationsService.exportApplications(filters);

    const header = EXPORT_FIELDS.join(',');
    const rows = applications.map((app) =>
        EXPORT_FIELDS.map((f) => {
            let val;
            if (f === 'createdAt') val = new Date(app[f]).toISOString();
            else if (f === 'resume') val = app.resumeUrl ? 'Attached' : '';
            else val = app[f] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
    return res.status(HTTP_STATUS.OK).send(csv);
});

// Streams the CV of one application to a signed-in admin with Job
// Applications access. The file is the one recorded on that application,
// read with the server's own storage credentials and only from resumes/ —
// nothing in the request names a file, a key or a bucket.
const downloadResume = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('CV not found', HTTP_STATUS.NOT_FOUND);
    const application = await JobApplication.findById(req.params.id).select('resumeUrl resumeFileName resumeOriginalName');
    if (!application) throw new AppError('CV not found', HTTP_STATUS.NOT_FOUND);

    const file = await openResume(application);
    if (!file) throw new AppError('This application has no CV in the CMS storage', HTTP_STATUS.NOT_FOUND);
    if (file.missing) throw new AppError('The CV file is missing from storage', HTTP_STATUS.NOT_FOUND);

    logger.info('Job application CV opened', { application: String(application._id), by: String(req.user?._id || '') });
    return sendOpenedFile(res, file);
});

module.exports = {
    getAllApplications,
    getApplicationById,
    submitApplication,
    updateApplicationStatus,
    deleteApplication,
    exportApplications,
    downloadResume
};
