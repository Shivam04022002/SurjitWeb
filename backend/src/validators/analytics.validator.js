const { body, query } = require('express-validator');
const { RANGES } = require('../services/analytics.service');

const RANGE_KEYS = Object.keys(RANGES);

// Public beacon. Only these fields are read; everything else in the body is
// ignored by the controller.
const trackPageViewValidation = [
    body('sessionId')
        .trim().notEmpty().withMessage('sessionId is required')
        .isLength({ max: 64 }).withMessage('sessionId is too long')
        .matches(/^[A-Za-z0-9_-]+$/).withMessage('sessionId has an invalid format'),
    // Path only. A leading slash is required so a full URL (which could carry a
    // query string) cannot be submitted as the path.
    body('path')
        .trim().notEmpty().withMessage('path is required')
        .isLength({ max: 300 }).withMessage('path is too long')
        .matches(/^\/[^?#\s]*$/).withMessage('path must be a route path without query or fragment'),
    body('referrer')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 500 }).withMessage('referrer is too long'),
    body('sessionStartedAt')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('sessionStartedAt must be a valid date')
];

// Admin read. An allowlist, so no arbitrary date window or filter can be passed.
const overviewValidation = [
    query('range')
        .optional({ checkFalsy: true })
        .isIn(RANGE_KEYS).withMessage(`range must be one of: ${RANGE_KEYS.join(', ')}`)
];

module.exports = { trackPageViewValidation, overviewValidation, RANGE_KEYS };
