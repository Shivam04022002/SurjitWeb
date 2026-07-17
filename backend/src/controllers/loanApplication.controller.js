const LoanApplication = require('../models/LoanApplication');
const { sendSuccess } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const buildApplicationData = (body, files) => {
    const applicationData = { ...body };

    if (files) {
        if (files.aadhaarDoc) {
            applicationData.aadhaarCardUrl = env.AWS_S3_BUCKET_NAME
                ? files.aadhaarDoc[0].location
                : files.aadhaarDoc[0].path;
        }
        if (files.panDoc) {
            applicationData.panCardUrl = env.AWS_S3_BUCKET_NAME
                ? files.panDoc[0].location
                : files.panDoc[0].path;
        }
        if (files.bankStatementDoc) {
            applicationData.bankStatementUrl = env.AWS_S3_BUCKET_NAME
                ? files.bankStatementDoc[0].location
                : files.bankStatementDoc[0].path;
        }
        if (files.businessProofDoc) {
            applicationData.businessProofUrl = env.AWS_S3_BUCKET_NAME
                ? files.businessProofDoc[0].location
                : files.businessProofDoc[0].path;
        }
    }

    return applicationData;
};

const submitLoanApplication = asyncHandler(async (req, res) => {
    const applicationData = buildApplicationData(req.body, req.files);
    const application = await LoanApplication.create(applicationData);

    return sendSuccess(
        res,
        'Loan application submitted successfully!',
        {
            applicationNumber: application.applicationNumber,
            application
        },
        HTTP_STATUS.CREATED
    );
});

const getApplicationStatus = asyncHandler(async (req, res) => {
    const application = await LoanApplication.findOne({ applicationNumber: req.params.applicationNumber });

    if (!application) {
        return sendSuccess(res, 'Application not found', {}, HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, 'Application status fetched successfully', {
        applicationNumber: application.applicationNumber,
        status: application.status,
        loanType: application.loanType,
        loanAmount: application.loanAmount,
        createdAt: application.createdAt
    }, HTTP_STATUS.OK);
});

const getAllApplications = asyncHandler(async (req, res) => {
    const applications = await LoanApplication.find().sort({ createdAt: -1 });
    return sendSuccess(res, 'Loan applications fetched successfully', { applications }, HTTP_STATUS.OK);
});

module.exports = {
    submitLoanApplication,
    getApplicationStatus,
    getAllApplications
};
