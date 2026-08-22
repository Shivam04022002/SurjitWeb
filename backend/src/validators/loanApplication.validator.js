const { body } = require('express-validator');
const { LOAN_TYPES } = require('../constants/loanTypes');

// Every field the model marks required is validated here, so a missing value
// comes back as a 400 with field errors rather than surfacing as a Mongoose
// ValidationError (which the error handler reports as a 500).
const loanValidation = [
    // Optional: the generic "Apply Now" entry point carries no product. When
    // present it must be a well-formed id; the controller then resolves it
    // against the database and rejects anything that does not exist.
    body('productId')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Invalid product reference'),

    body('fullName').trim().notEmpty().withMessage('Full name is required')
        .isLength({ max: 150 }).withMessage('Full name must not exceed 150 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required')
        .isLength({ max: 160 }).withMessage('Email must not exceed 160 characters'),
    body('phone').trim().notEmpty().withMessage('Phone is required')
        .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Enter a valid phone number'),
    body('dob').notEmpty().withMessage('Date of birth is required')
        .isISO8601().withMessage('Valid date of birth is required'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
    body('pan').trim().toUpperCase()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/).withMessage('Valid PAN is required'),
    body('aadhaar').trim()
        .matches(/^[0-9]{12}$/).withMessage('Valid 12-digit Aadhaar is required'),

    // Previously unvalidated, and required by the model — an empty value used
    // to reach Mongoose and come back as a 500.
    body('address').trim().notEmpty().withMessage('Address is required')
        .isLength({ max: 500 }).withMessage('Address must not exceed 500 characters'),
    body('city').trim().notEmpty().withMessage('City is required')
        .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
    body('state').trim().notEmpty().withMessage('State is required')
        .isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
    body('pincode').trim().matches(/^[0-9]{6}$/).withMessage('Valid 6-digit pincode is required'),

    body('loanType').isIn(LOAN_TYPES).withMessage('Valid loan type is required'),
    // isNumeric alone accepted "-500000" and "0"; a loan must be a positive
    // amount, and a non-numeric string must not be coerced into one.
    body('loanAmount')
        .isFloat({ gt: 0 }).withMessage('Loan amount must be greater than zero').toFloat(),
    body('tenure')
        .isInt({ gt: 0 }).withMessage('Tenure must be a positive number of months').toInt(),
    body('loanPurpose').trim().notEmpty().withMessage('Purpose of loan is required')
        .isLength({ max: 1000 }).withMessage('Purpose must not exceed 1000 characters'),

    body('employmentType').isIn(['self-employed', 'business-owner', 'salaried'])
        .withMessage('Valid employment type is required'),
    body('monthlyIncome')
        .isFloat({ gt: 0 }).withMessage('Monthly income must be greater than zero').toFloat(),
    body('workExperience').trim().notEmpty().withMessage('Work experience is required')
        .isLength({ max: 100 }).withMessage('Work experience must not exceed 100 characters'),
    body('businessName').optional({ checkFalsy: true }).trim()
        .isLength({ max: 200 }).withMessage('Business name must not exceed 200 characters'),
    body('businessType').optional({ checkFalsy: true }).trim()
        .isLength({ max: 200 }).withMessage('Business type must not exceed 200 characters'),

    // The UI has always required the tick; now it has to arrive and be true.
    body('consentAccepted')
        .custom((v) => v === true || v === 'true')
        .withMessage('You must accept the terms to submit an application')
];

module.exports = { loanValidation };
