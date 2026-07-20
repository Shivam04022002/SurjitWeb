const { body } = require('express-validator');

// Optional on update because the CMS posts partial multipart payloads.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('customerName').trim().notEmpty().withMessage('Customer name is required'))
            .isLength({ max: 120 }).withMessage('Customer name must not exceed 120 characters'),
        t(body('rating').notEmpty().withMessage('Rating is required'))
            .isInt({ min: 1, max: 5 }).withMessage('Rating must be a whole number between 1 and 5').toInt(),
        t(body('review').trim().notEmpty().withMessage('Review text is required'))
            .isLength({ max: 1000 }).withMessage('Review must not exceed 1000 characters'),

        body('productName').optional().trim()
            .isLength({ max: 150 }).withMessage('Product name must not exceed 150 characters'),
        body('location').optional().trim()
            .isLength({ max: 120 }).withMessage('Location must not exceed 120 characters'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
        body('isPublished').optional()
            .isBoolean().withMessage('isPublished must be boolean')
    ];
};

const createReviewValidation = sharedRules(true);
const updateReviewValidation = sharedRules(false);

const reorderReviewsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid review id')
];

module.exports = { createReviewValidation, updateReviewValidation, reorderReviewsValidation };
