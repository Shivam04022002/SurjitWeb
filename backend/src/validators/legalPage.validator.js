const { body } = require('express-validator');
const { LEGAL_TYPES } = require('../models/LegalPage');

// Optional on update because the CMS posts partial multipart payloads; the
// presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('title').trim().notEmpty().withMessage('Title is required'))
            .isLength({ max: 200 }).withMessage('Title must not exceed 200 characters'),
        t(body('slug').trim().notEmpty().withMessage('Slug is required'))
            .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug may contain only lowercase letters, numbers and hyphens')
            .isLength({ max: 200 }).withMessage('Slug must not exceed 200 characters'),
        t(body('type').notEmpty().withMessage('Type is required'))
            .isIn(LEGAL_TYPES).withMessage(`Type must be one of: ${LEGAL_TYPES.join(', ')}`),

        body('description').optional({ checkFalsy: true }).trim()
            .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
        body('content').optional({ checkFalsy: true }),
        body('seoTitle').optional({ checkFalsy: true }).trim()
            .isLength({ max: 200 }).withMessage('SEO title must not exceed 200 characters'),
        body('seoDescription').optional({ checkFalsy: true }).trim()
            .isLength({ max: 500 }).withMessage('SEO description must not exceed 500 characters'),
        body('status').optional()
            .isIn(['Published', 'Draft']).withMessage('Status must be Published or Draft'),
        body('displayOrder').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt()
    ];
};

const createPageValidation = sharedRules(true);
const updatePageValidation = sharedRules(false);

const reorderPagesValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid legal page id')
];

module.exports = { createPageValidation, updatePageValidation, reorderPagesValidation };
