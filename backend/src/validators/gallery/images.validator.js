const { body } = require('express-validator');

const updateImageValidation = [
    body('caption')
        .optional().trim()
        .isLength({ max: 500 }).withMessage('Caption must not exceed 500 characters'),
    body('altText')
        .optional().trim()
        .isLength({ max: 300 }).withMessage('Alt text must not exceed 300 characters'),
    body('displayOrder')
        .optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

const reorderImagesValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid MongoDB ObjectId')
];

module.exports = { updateImageValidation, reorderImagesValidation };
