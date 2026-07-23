const { body } = require('express-validator');

// Optional on update because the CMS sends only the fields being changed; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('companyName').trim().notEmpty().withMessage('Company name is required'))
            .isLength({ max: 150 }).withMessage('Company name must not exceed 150 characters'),
        t(body('officerName').trim().notEmpty().withMessage('Officer name is required'))
            .isLength({ max: 120 }).withMessage('Officer name must not exceed 120 characters'),
        t(body('designation').trim().notEmpty().withMessage('Designation is required'))
            .isLength({ max: 200 }).withMessage('Designation must not exceed 200 characters'),
        t(body('address').trim().notEmpty().withMessage('Address is required'))
            .isLength({ max: 400 }).withMessage('Address must not exceed 400 characters'),
        t(body('email').trim().notEmpty().withMessage('Email is required'))
            .isEmail().withMessage('Enter a valid email address')
            .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters')
            .normalizeEmail(),
        t(body('phone').trim().notEmpty().withMessage('Phone is required'))
            .matches(/^[\d+\-()\s]{6,30}$/).withMessage('Enter a valid phone number'),

        body('status').optional()
            .isIn(['Published', 'Draft']).withMessage('Status must be Published or Draft'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt()
    ];
};

const createOfficerValidation = sharedRules(true);
const updateOfficerValidation = sharedRules(false);

const reorderOfficersValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid nodal officer id')
];

module.exports = { createOfficerValidation, updateOfficerValidation, reorderOfficersValidation };
