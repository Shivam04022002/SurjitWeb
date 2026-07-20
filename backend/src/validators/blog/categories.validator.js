const { body } = require('express-validator');

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createCategoryValidation = [
    body('name')
        .trim().notEmpty().withMessage('Category name is required')
        .isLength({ max: 120 }).withMessage('Name must not exceed 120 characters'),
    body('slug')
        .trim().notEmpty().withMessage('Slug is required')
        .isLength({ max: 150 }).withMessage('Slug must not exceed 150 characters')
        .matches(SLUG_RX).withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description')
        .optional().trim()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    body('displayOrder')
        .optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

const updateCategoryValidation = [
    body('name')
        .optional().trim().notEmpty().withMessage('Category name cannot be empty')
        .isLength({ max: 120 }).withMessage('Name must not exceed 120 characters'),
    body('slug')
        .optional().trim().notEmpty().withMessage('Slug cannot be empty')
        .isLength({ max: 150 }).withMessage('Slug must not exceed 150 characters')
        .matches(SLUG_RX).withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description')
        .optional().trim()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
    body('displayOrder')
        .optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

module.exports = { createCategoryValidation, updateCategoryValidation };
