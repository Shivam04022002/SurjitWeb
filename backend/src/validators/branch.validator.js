const { body } = require('express-validator');

// Optional on update because the CMS sends only the fields being changed; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('branchName').trim().notEmpty().withMessage('Branch name is required'))
            .isLength({ max: 150 }).withMessage('Branch name must not exceed 150 characters'),
        t(body('address').trim().notEmpty().withMessage('Address is required'))
            .isLength({ max: 300 }).withMessage('Address must not exceed 300 characters'),
        t(body('city').trim().notEmpty().withMessage('City is required'))
            .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
        t(body('state').trim().notEmpty().withMessage('State is required'))
            .isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
        t(body('pincode').trim().notEmpty().withMessage('Pincode is required'))
            .matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),

        body('phone').optional({ checkFalsy: true }).trim()
            .isLength({ max: 20 }).withMessage('Phone must not exceed 20 characters')
            .matches(/^[\d+\-()\s]{6,20}$/).withMessage('Enter a valid phone number'),
        body('email').optional({ checkFalsy: true }).trim()
            .isEmail().withMessage('Enter a valid email address')
            .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters')
            .normalizeEmail(),
        body('googleMapUrl').optional({ checkFalsy: true }).trim()
            .isLength({ max: 500 }).withMessage('Google Map URL must not exceed 500 characters')
            .isURL({ protocols: ['http', 'https'], require_protocol: true })
            .withMessage('Enter a valid URL starting with http:// or https://'),
        body('status').optional()
            .isIn(['Published', 'Draft']).withMessage('Status must be Published or Draft'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt()
    ];
};

const createBranchValidation = sharedRules(true);
const updateBranchValidation = sharedRules(false);

const reorderBranchesValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid branch id')
];

module.exports = { createBranchValidation, updateBranchValidation, reorderBranchesValidation };
