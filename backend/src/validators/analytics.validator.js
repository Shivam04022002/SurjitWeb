const { body, query } = require('express-validator');
const { RANGES, MAX_CUSTOM_DAYS } = require('../services/analytics.service');
const { EVENT_ACTION_KEYS } = require('../constants/analyticsEvents');
// Custom ranges are UTC calendar days, matching the service.
const zoned = require('../utils/zonedDate').utc;

const RANGE_KEYS = Object.keys(RANGES);

const sessionIdRule = () => body('sessionId')
    .trim().notEmpty().withMessage('sessionId is required')
    .isLength({ max: 64 }).withMessage('sessionId is too long')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('sessionId has an invalid format');

// Path only. A leading slash is required so a full URL (which could carry a
// query string) cannot be submitted as the path.
const routePathRule = (field) => body(field)
    .trim().notEmpty().withMessage(`${field} is required`)
    .isLength({ max: 300 }).withMessage(`${field} is too long`)
    .matches(/^\/[^?#\s]*$/).withMessage(`${field} must be a route path without query or fragment`);

// Public beacon. Only these fields are read; everything else in the body is
// ignored by the controller.
const trackPageViewValidation = [
    sessionIdRule(),
    routePathRule('path'),
    body('referrer')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 500 }).withMessage('referrer is too long'),
    body('sessionStartedAt')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('sessionStartedAt must be a valid date')
];

// Public action beacon. The action is an allowlist; the optional target is an
// internal route path only, so no phone number, email address or external URL
// can be written through it.
const trackEventValidation = [
    sessionIdRule(),
    body('action')
        .trim().isIn(EVENT_ACTION_KEYS).withMessage('action is not a tracked action'),
    routePathRule('path'),
    body('target')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 300 }).withMessage('target is too long')
        .matches(/^\/[^?#\s]*$/).withMessage('target must be a route path without query or fragment')
];

// Admin read. Presets are an allowlist; a custom window needs two real calendar
// days, in order, not in the future, and no more than MAX_CUSTOM_DAYS apart.
const rangeValidation = [
    query('range')
        .optional({ checkFalsy: true })
        .isIn(RANGE_KEYS).withMessage(`range must be one of: ${RANGE_KEYS.join(', ')}`),
    query('from')
        .if(query('range').equals('custom'))
        .custom((v) => zoned.isValidDay(v)).withMessage('from must be a date in YYYY-MM-DD format'),
    query('to')
        .if(query('range').equals('custom'))
        .custom((v) => zoned.isValidDay(v)).withMessage('to must be a date in YYYY-MM-DD format')
        .bail()
        .custom((v, { req }) => !zoned.isValidDay(req.query.from) || req.query.from <= v)
        .withMessage('from must be on or before to')
        .bail()
        .custom((v) => v <= zoned.today()).withMessage('to cannot be in the future')
        .bail()
        .custom((v, { req }) => !zoned.isValidDay(req.query.from) ||
            zoned.daysBetween(req.query.from, v) < MAX_CUSTOM_DAYS)
        .withMessage(`A custom range can span at most ${MAX_CUSTOM_DAYS} days`)
];

const overviewValidation = rangeValidation;

const paginationValidation = [
    query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt()
];

const pagesValidation = [...rangeValidation, ...paginationValidation];

// The city list: the same window and paging, plus a search term that only
// narrows which cities are listed.
const citiesValidation = [
    ...rangeValidation,
    ...paginationValidation,
    query('search').optional({ checkFalsy: true }).trim()
        .isLength({ max: 120 }).withMessage('search is too long')
];

// The hourly city view: the same window, paging and search, plus an hour of the
// UTC day and a single city. Midnight arrives as the string '0', which is
// truthy, so it is validated like any other hour rather than read as absent.
const cityHourlyValidation = [
    ...citiesValidation,
    query('hour')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 23 }).withMessage('hour must be a UTC hour between 0 and 23'),
    query('city')
        .optional({ checkFalsy: true }).trim()
        .isLength({ max: 120 }).withMessage('city is too long')
];

module.exports = {
    trackPageViewValidation, trackEventValidation, overviewValidation, pagesValidation,
    citiesValidation, cityHourlyValidation, RANGE_KEYS
};
