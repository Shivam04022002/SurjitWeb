const { body } = require('express-validator');

const createProductValidation = [
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isMongoId()
        .withMessage('Category must be a valid ID'),

    body('name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
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

    body('heroTitle')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('Hero title must not exceed 300 characters'),

    body('heroDescription')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Hero description must not exceed 1000 characters'),

    body('shortDescription')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description must not exceed 500 characters'),

    body('longDescription')
        .optional()
        .trim(),

    body('displayOrder')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Display order must be a non-negative integer'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
];

const updateProductValidation = [
    body('category')
        .optional()
        .isMongoId()
        .withMessage('Category must be a valid ID'),

    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Product name cannot be empty')
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

    body('heroTitle')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('Hero title must not exceed 300 characters'),

    body('heroDescription')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Hero description must not exceed 1000 characters'),

    body('shortDescription')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Short description must not exceed 500 characters'),

    body('longDescription')
        .optional()
        .trim(),

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
    createProductValidation,
    updateProductValidation,
    reorderValidation
};
