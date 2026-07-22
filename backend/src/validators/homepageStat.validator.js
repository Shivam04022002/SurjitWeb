const { body } = require('express-validator');

// Optional on update because the CMS sends only the fields being changed; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('title').trim().notEmpty().withMessage('Title is required'))
            .isLength({ max: 100 }).withMessage('Title must not exceed 100 characters'),
        // Deliberately permissive: an editor types the figure exactly as it
        // should read ("35+", "10K+", "₹50Cr+"). A value with no digit still
        // renders — the homepage just shows it without counting up.
        t(body('value').trim().notEmpty().withMessage('Value is required'))
            .isLength({ max: 20 }).withMessage('Value must not exceed 20 characters'),

        body('icon').optional({ checkFalsy: true }).trim()
            .isLength({ max: 50 }).withMessage('Icon must not exceed 50 characters'),
        body('status').optional()
            .isIn(['Published', 'Draft']).withMessage('Status must be Published or Draft'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt()
    ];
};

const createStatValidation = sharedRules(true);
const updateStatValidation = sharedRules(false);

const reorderStatsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid statistic id')
];

module.exports = { createStatValidation, updateStatValidation, reorderStatsValidation };
