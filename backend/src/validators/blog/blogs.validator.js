const { body } = require('express-validator');

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Optional because multipart sends absent fields as undefined and the CMS
// posts partial updates; presence rules live on the create chain only.
const sharedRules = (required) => {
    const t = (chain) => (required ? chain : chain.optional());

    return [
        t(body('title').trim().notEmpty().withMessage('Blog title is required'))
            .isLength({ max: 250 }).withMessage('Title must not exceed 250 characters'),
        t(body('slug').trim().notEmpty().withMessage('Slug is required'))
            .isLength({ max: 300 }).withMessage('Slug must not exceed 300 characters')
            .matches(SLUG_RX).withMessage('Slug must be lowercase alphanumeric with hyphens only'),
        t(body('summary').trim().notEmpty().withMessage('Short description is required'))
            .isLength({ max: 1000 }).withMessage('Short description must not exceed 1000 characters'),
        t(body('content').notEmpty().withMessage('Content is required')),

        body('author').optional().trim()
            .isLength({ max: 120 }).withMessage('Author must not exceed 120 characters'),
        body('readingTime').optional({ checkFalsy: true })
            .isInt({ min: 0 }).withMessage('Reading time must be a non-negative integer').toInt(),
        body('status').optional()
            .isIn(['draft', 'published']).withMessage('Status must be draft or published'),
        body('publishedAt').optional({ checkFalsy: true })
            .isISO8601().withMessage('Publish date must be a valid date'),
        body('category').optional({ nullable: true, checkFalsy: true })
            .isMongoId().withMessage('Category must be a valid id'),

        body('seo.metaTitle').optional().trim()
            .isLength({ max: 250 }).withMessage('SEO title must not exceed 250 characters'),
        body('seo.metaDescription').optional().trim()
            .isLength({ max: 500 }).withMessage('SEO description must not exceed 500 characters'),
        body('seo.metaKeywords').optional().trim()
            .isLength({ max: 500 }).withMessage('SEO keywords must not exceed 500 characters')
    ];
};

const createBlogValidation = sharedRules(true);
const updateBlogValidation = sharedRules(false);

module.exports = { createBlogValidation, updateBlogValidation };
