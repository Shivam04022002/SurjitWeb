const { body } = require('express-validator');

// Optional on update because the CMS posts partial multipart payloads; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('title').trim().notEmpty().withMessage('Report title is required'))
            .isLength({ max: 200 }).withMessage('Title must not exceed 200 characters'),
        t(body('year').notEmpty().withMessage('Year is required'))
            .isInt({ min: 1900, max: 2200 }).withMessage('Enter a valid year').toInt(),

        body('financialYear').optional({ checkFalsy: true }).trim()
            .isLength({ max: 20 }).withMessage('Financial year must not exceed 20 characters')
            .matches(/^\d{4}(-\d{2,4})?$/).withMessage('Use a format like 2024-25'),
        body('description').optional({ checkFalsy: true }).trim()
            .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
        body('status').optional()
            .isIn(['Published', 'Draft']).withMessage('Status must be Published or Draft'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt()
    ];
};

const createReportValidation = sharedRules(true);
const updateReportValidation = sharedRules(false);

const reorderReportsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid report id')
];

module.exports = { createReportValidation, updateReportValidation, reorderReportsValidation };
