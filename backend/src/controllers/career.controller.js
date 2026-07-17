const JobApplication = require('../models/JobApplication');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const submitJobApplication = asyncHandler(async (req, res) => {
    const applicationData = { ...req.body };

    if (req.file) {
        applicationData.resumeUrl = env.AWS_S3_BUCKET_NAME ? req.file.location : req.file.path;
    }

    const application = await JobApplication.create(applicationData);
    return sendSuccess(res, 'Application submitted successfully! We will contact you soon.', application, HTTP_STATUS.CREATED);
});

const getAllApplications = asyncHandler(async (req, res) => {
    const applications = await JobApplication.find().sort({ createdAt: -1 });
    return sendSuccess(res, 'Job applications fetched successfully', { applications }, HTTP_STATUS.OK);
});

module.exports = {
    submitJobApplication,
    getAllApplications
};
