const { body } = require('express-validator');

const createAlbumValidation = [
    body('title')
        .trim().notEmpty().withMessage('Album title is required')
        .isLength({ max: 200 }).withMessage('Title must not exceed 200 characters'),
    body('slug')
        .trim().notEmpty().withMessage('Slug is required')
        .isLength({ max: 250 }).withMessage('Slug must not exceed 250 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description')
        .optional().trim()
        .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
    body('displayOrder')
        .optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

const updateAlbumValidation = [
    body('title')
        .optional().trim().notEmpty().withMessage('Album title cannot be empty')
        .isLength({ max: 200 }).withMessage('Title must not exceed 200 characters'),
    body('slug')
        .optional().trim().notEmpty().withMessage('Slug cannot be empty')
        .isLength({ max: 250 }).withMessage('Slug must not exceed 250 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description')
        .optional().trim()
        .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
    body('displayOrder')
        .optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isActive')
        .optional().isBoolean().withMessage('isActive must be boolean').toBoolean()
];

const reorderAlbumsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid MongoDB ObjectId')
];

module.exports = { createAlbumValidation, updateAlbumValidation, reorderAlbumsValidation };
