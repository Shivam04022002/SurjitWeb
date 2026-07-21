const { body } = require('express-validator');

// Public submission. Everything a visitor can send is validated here; status
// is never accepted from the request — the service sets it.
const submitReviewValidation = [
    body('customerName')
        .trim().notEmpty().withMessage('Name is required')
        .isLength({ max: 120 }).withMessage('Name must not exceed 120 characters'),
    body('mobile')
        .trim().notEmpty().withMessage('Mobile number is required')
        .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Enter a valid mobile number'),
    body('email')
        .optional({ checkFalsy: true }).trim()
        .isEmail().withMessage('Enter a valid email address')
        .isLength({ max: 160 }).withMessage('Email must not exceed 160 characters'),
    body('city')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 120 }).withMessage('City must not exceed 120 characters'),
    body('productName')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 150 }).withMessage('Product must not exceed 150 characters'),
    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt(),
    body('review')
        .trim().notEmpty().withMessage('Review is required')
        .isLength({ min: 10 }).withMessage('Please write at least 10 characters')
        .isLength({ max: 1000 }).withMessage('Review must not exceed 1000 characters')
];

const reorderReviewsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid review id')
];

module.exports = { submitReviewValidation, reorderReviewsValidation };
