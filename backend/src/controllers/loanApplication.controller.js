const mongoose = require('mongoose');
const LoanApplication = require('../models/LoanApplication');
const Product = require('../models/Product');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');
const HTTP_STATUS = require('../constants/httpStatus');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { loanTypeForCategorySlug } = require('../constants/loanTypes');

// Fields a public applicant is allowed to supply. Everything else the model
// holds — applicationNumber, status, notes, deletedAt, timestamps, document
// URLs — is server-controlled and is never read from the request body.
const APPLICANT_FIELDS = [
    'fullName', 'email', 'phone', 'dob', 'gender', 'pan', 'aadhaar',
    'address', 'city', 'state', 'pincode',
    'loanType', 'loanAmount', 'loanPurpose', 'tenure',
    'employmentType', 'businessName', 'businessType', 'monthlyIncome', 'workExperience'
];

// Uploaded file field -> the model column its stored URL belongs in.
const DOCUMENT_FIELDS = {
    aadhaarDoc: 'aadhaarCardUrl',
    panDoc: 'panCardUrl',
    bankStatementDoc: 'bankStatementUrl',
    businessProofDoc: 'businessProofUrl'
};

// Fields the admin list may return. Deliberately excludes PAN, Aadhaar, DOB,
// address and document URLs — a list view has no need for them, and they are
// served only by the detail endpoint.
const LIST_FIELDS = 'applicationNumber fullName phone email product loanType loanAmount status createdAt';

// S3 in production, local disk otherwise — mirrors the upload middleware's own
// storage decision.
const storedUrlOf = (file) => (env.AWS_S3_BUCKET_NAME ? file.location : file.path);

// Resolves the submitted product id against the database. The product name a
// client sends is never trusted: only the id is used, and only after it is
// confirmed to reference a real, active product.
const resolveProduct = async (productId) => {
    if (!productId) return null;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError('Invalid product reference', HTTP_STATUS.BAD_REQUEST);
    }
    const product = await Product.findOne({ _id: productId, isActive: true })
        .populate('category', 'slug name')
        .select('_id name slug category isActive');
    if (!product) {
        throw new AppError('Selected product does not exist or is no longer available', HTTP_STATUS.BAD_REQUEST);
    }
    return product;
};

const buildApplicationData = (body, files) => {
    // Explicit whitelist rather than a spread of req.body, so a crafted
    // payload cannot set status, applicationNumber, notes or deletedAt.
    const applicationData = {};
    APPLICANT_FIELDS.forEach((field) => {
        if (body[field] !== undefined) applicationData[field] = body[field];
    });

    if (files) {
        Object.entries(DOCUMENT_FIELDS).forEach(([fileField, urlField]) => {
            if (files[fileField] && files[fileField][0]) {
                applicationData[urlField] = storedUrlOf(files[fileField][0]);
            }
        });
    }

    return applicationData;
};

const submitLoanApplication = asyncHandler(async (req, res) => {
    const applicationData = buildApplicationData(req.body, req.files);

    // Product association. The category decides the loanType, so a mismatched
    // pair (vehicle product submitted as a LAP application) is rejected rather
    // than silently stored.
    const product = await resolveProduct(req.body.productId);
    if (product) {
        applicationData.product = product._id;
        const derived = loanTypeForCategorySlug(product.category?.slug);
        if (derived) {
            if (applicationData.loanType && applicationData.loanType !== derived) {
                throw new AppError(
                    'Selected loan type does not match the chosen product',
                    HTTP_STATUS.BAD_REQUEST
                );
            }
            applicationData.loanType = derived;
        }
    }

    // Consent is validated by the validator; the timestamp is set here so it
    // records when the server accepted it, not a client-supplied moment.
    applicationData.consentAccepted = true;
    applicationData.consentAcceptedAt = new Date();

    const application = await LoanApplication.create(applicationData);

    // Only the reference the applicant needs. The full document holds PAN,
    // Aadhaar, DOB and address and is never echoed back over a public route.
    return sendSuccess(
        res,
        'Loan application submitted successfully!',
        { applicationNumber: application.applicationNumber },
        HTTP_STATUS.CREATED
    );
});

// Public status lookup. Intentionally narrow: it confirms progress to an
// applicant holding their own reference number and exposes nothing else.
const getApplicationStatus = asyncHandler(async (req, res) => {
    const application = await LoanApplication.findOne({ applicationNumber: req.params.applicationNumber })
        .select('applicationNumber status createdAt');

    if (!application) {
        return sendSuccess(res, 'Application not found', {}, HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, 'Application status fetched successfully', {
        applicationNumber: application.applicationNumber,
        status: application.status,
        createdAt: application.createdAt
    }, HTTP_STATUS.OK);
});

// ── Admin ─────────────────────────────────────────────────────────────────────

const getAllApplications = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.loanType) query.loanType = req.query.loanType;
    if (req.query.product && mongoose.Types.ObjectId.isValid(req.query.product)) {
        query.product = req.query.product;
    }
    if (req.query.search) {
        const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ applicationNumber: rx }, { fullName: rx }, { phone: rx }, { email: rx }];
    }

    const [data, total] = await Promise.all([
        LoanApplication.find(query)
            .select(LIST_FIELDS)
            .populate('product', 'name slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        LoanApplication.countDocuments(query)
    ]);

    return sendSuccess(res, 'Loan applications fetched successfully', {
        applications: data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
    }, HTTP_STATUS.OK);
});

// Full record, including the sensitive fields the list withholds.
const getApplicationById = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new AppError('Invalid application id', HTTP_STATUS.BAD_REQUEST);
    }
    const application = await LoanApplication.findById(req.params.id)
        .populate('product', 'name slug');
    if (!application) {
        throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, 'Loan application fetched successfully', { application }, HTTP_STATUS.OK);
});

module.exports = {
    submitLoanApplication,
    getApplicationStatus,
    getAllApplications,
    getApplicationById
};
