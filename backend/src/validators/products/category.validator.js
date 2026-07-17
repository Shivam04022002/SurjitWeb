const { body } = require('express-validator');

const createCategoryValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Category name is required')
        .isLength({ max: 200 })
        .withMessage('Name must not exceed 200 characters'),

    body('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug is required')
        .isLength({ max: 200 })
        .withMessage('Slug must not exceed 200 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage('Slug must be lowercase letters, numbers, and hyphens only'),

    body('shortDescription')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description must not exceed 500 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
];

const updateCategoryValidation = [
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Category name cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Name must not exceed 200 characters'),

    body('slug')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Slug cannot be empty')
        .isLength({ max: 200 })
        .withMessage('Slug must not exceed 200 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage('Slug must be lowercase letters, numbers, and hyphens only'),

    body('shortDescription')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description must not exceed 500 characters'),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
];

const reorderValidation = [
    body('ids')
        .isArray({ min: 1 })
        .withMessage('ids must be a non-empty array'),

    body('ids.*')
        .notEmpty()
        .withMessage('Each id must be a non-empty string')
];

module.exports = {
    createCategoryValidation,
    updateCategoryValidation,
    reorderValidation
};
