const { body } = require('express-validator');

const updateSettingsValidation = [
    // ── Company ────────────────────────────────────────────────────────────────
    body('companyName').optional().trim().isLength({ max: 200 }).withMessage('Company name must not exceed 200 characters'),
    body('tagline').optional().trim().isLength({ max: 500 }).withMessage('Tagline must not exceed 500 characters'),
    body('companyDescription').optional().trim(),

    // ── Contact ────────────────────────────────────────────────────────────────
    body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone must not exceed 20 characters'),
    body('alternatePhone').optional().trim().isLength({ max: 20 }).withMessage('Alternate phone must not exceed 20 characters'),
    body('tollFreeNumber').optional().trim().isLength({ max: 20 }).withMessage('Toll free number must not exceed 20 characters'),
    body('email')
        .optional({ checkFalsy: true })
        .trim().isEmail().withMessage('Email must be a valid email address')
        .isLength({ max: 200 }).withMessage('Email must not exceed 200 characters'),
    body('supportEmail')
        .optional({ checkFalsy: true })
        .trim().isEmail().withMessage('Support email must be a valid email address')
        .isLength({ max: 200 }).withMessage('Support email must not exceed 200 characters'),
    body('whatsappNumber').optional().trim().isLength({ max: 20 }).withMessage('WhatsApp number must not exceed 20 characters'),

    // ── Address ────────────────────────────────────────────────────────────────
    body('officeAddress').optional().trim().isLength({ max: 500 }).withMessage('Office address must not exceed 500 characters'),
    body('city').optional().trim().isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
    body('state').optional().trim().isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
    body('country').optional().trim().isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),
    body('pinCode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^\d{4,10}$/).withMessage('PIN code must be 4–10 digits'),
    body('googleMapsUrl')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Google Maps URL must be a valid URL')
        .isLength({ max: 1000 }).withMessage('Google Maps URL must not exceed 1000 characters'),

    // ── Social Media ───────────────────────────────────────────────────────────
    body('facebook')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Facebook URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),
    body('instagram')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Instagram URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),
    body('linkedin')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('LinkedIn URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),
    body('youtube')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('YouTube URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),
    body('twitter')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Twitter/X URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),

    // ── Header ─────────────────────────────────────────────────────────────────
    body('headerPrimaryButtonText').optional().trim().isLength({ max: 100 }).withMessage('Button text must not exceed 100 characters'),
    body('headerPrimaryButtonUrl')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Primary button URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),
    body('headerSecondaryButtonText').optional().trim().isLength({ max: 100 }).withMessage('Button text must not exceed 100 characters'),
    body('headerSecondaryButtonUrl')
        .optional({ checkFalsy: true })
        .trim().isURL({ require_protocol: true }).withMessage('Secondary button URL must be a valid URL')
        .isLength({ max: 500 }).withMessage('URL must not exceed 500 characters'),

    // ── Footer ─────────────────────────────────────────────────────────────────
    body('footerDescription').optional().trim().isLength({ max: 1000 }).withMessage('Footer description must not exceed 1000 characters'),
    body('copyright').optional().trim().isLength({ max: 300 }).withMessage('Copyright text must not exceed 300 characters'),
    body('footerNote').optional().trim().isLength({ max: 500 }).withMessage('Footer note must not exceed 500 characters'),

    // ── Business Hours ─────────────────────────────────────────────────────────
    body('businessHours.monday').optional().trim().isLength({ max: 100 }).withMessage('Monday hours must not exceed 100 characters'),
    body('businessHours.tuesday').optional().trim().isLength({ max: 100 }).withMessage('Tuesday hours must not exceed 100 characters'),
    body('businessHours.wednesday').optional().trim().isLength({ max: 100 }).withMessage('Wednesday hours must not exceed 100 characters'),
    body('businessHours.thursday').optional().trim().isLength({ max: 100 }).withMessage('Thursday hours must not exceed 100 characters'),
    body('businessHours.friday').optional().trim().isLength({ max: 100 }).withMessage('Friday hours must not exceed 100 characters'),
    body('businessHours.saturday').optional().trim().isLength({ max: 100 }).withMessage('Saturday hours must not exceed 100 characters'),
    body('businessHours.sunday').optional().trim().isLength({ max: 100 }).withMessage('Sunday hours must not exceed 100 characters')
];

module.exports = { updateSettingsValidation };
