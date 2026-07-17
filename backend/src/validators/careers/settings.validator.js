const { body } = require('express-validator');

const updateSettingsValidation = [
    body('heroTitle').optional().trim().isLength({ max: 300 }).withMessage('Hero title must not exceed 300 characters'),
    body('heroSubtitle').optional().trim().isLength({ max: 600 }).withMessage('Hero subtitle must not exceed 600 characters'),
    body('joinOurTeamTitle').optional().trim().isLength({ max: 300 }).withMessage('Join Our Team title must not exceed 300 characters'),
    body('joinOurTeamDescription').optional().trim(),
    body('whyJoinTitle').optional().trim().isLength({ max: 300 }).withMessage('Why Join title must not exceed 300 characters'),
    body('whyJoinDescription').optional().trim(),
    body('seo.metaTitle').optional().trim().isLength({ max: 160 }).withMessage('Meta title must not exceed 160 characters'),
    body('seo.metaDescription').optional().trim().isLength({ max: 320 }).withMessage('Meta description must not exceed 320 characters'),
    body('seo.metaKeywords').optional().trim(),
    body('seo.canonicalUrl').optional().trim()
];

module.exports = { updateSettingsValidation };
