const { body } = require('express-validator');

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'internship', 'contract'];

const createJobValidation = [
    body('jobTitle').trim().notEmpty().withMessage('Job title is required').isLength({ max: 200 }).withMessage('Job title must not exceed 200 characters'),
    body('department').trim().notEmpty().withMessage('Department is required').isLength({ max: 200 }).withMessage('Department must not exceed 200 characters'),
    body('location').trim().notEmpty().withMessage('Location is required').isLength({ max: 200 }).withMessage('Location must not exceed 200 characters'),
    body('employmentType')
        .notEmpty().withMessage('Employment type is required')
        .isIn(EMPLOYMENT_TYPES).withMessage(`Employment type must be one of: ${EMPLOYMENT_TYPES.join(', ')}`),
    body('experienceRequired').optional().trim().isLength({ max: 200 }).withMessage('Experience required must not exceed 200 characters'),
    body('numberOfVacancies').optional().isInt({ min: 1 }).withMessage('Number of vacancies must be at least 1').toInt(),
    body('salary').optional().trim().isLength({ max: 200 }).withMessage('Salary must not exceed 200 characters'),
    body('shortDescription').optional().trim().isLength({ max: 500 }).withMessage('Short description must not exceed 500 characters'),
    body('fullDescription').optional().trim(),
    body('skillsRequired').optional().isArray().withMessage('Skills required must be an array'),
    body('skillsRequired.*').optional().trim().notEmpty().withMessage('Each skill must be a non-empty string'),
    body('responsibilities').optional().isArray().withMessage('Responsibilities must be an array'),
    body('responsibilities.*').optional().trim().notEmpty().withMessage('Each responsibility must be a non-empty string'),
    body('qualifications').optional().isArray().withMessage('Qualifications must be an array'),
    body('qualifications.*').optional().trim().notEmpty().withMessage('Each qualification must be a non-empty string'),
    body('displayOrder').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isPublished').optional().isBoolean().withMessage('isPublished must be boolean').toBoolean(),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
    body('applicationDeadline').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Application deadline must be a valid date')
];

const updateJobValidation = [
    body('jobTitle').optional().trim().notEmpty().withMessage('Job title cannot be empty').isLength({ max: 200 }).withMessage('Job title must not exceed 200 characters'),
    body('department').optional().trim().notEmpty().withMessage('Department cannot be empty').isLength({ max: 200 }).withMessage('Department must not exceed 200 characters'),
    body('location').optional().trim().notEmpty().withMessage('Location cannot be empty').isLength({ max: 200 }).withMessage('Location must not exceed 200 characters'),
    body('employmentType').optional()
        .isIn(EMPLOYMENT_TYPES).withMessage(`Employment type must be one of: ${EMPLOYMENT_TYPES.join(', ')}`),
    body('experienceRequired').optional().trim().isLength({ max: 200 }).withMessage('Experience required must not exceed 200 characters'),
    body('numberOfVacancies').optional().isInt({ min: 1 }).withMessage('Number of vacancies must be at least 1').toInt(),
    body('salary').optional().trim().isLength({ max: 200 }).withMessage('Salary must not exceed 200 characters'),
    body('shortDescription').optional().trim().isLength({ max: 500 }).withMessage('Short description must not exceed 500 characters'),
    body('fullDescription').optional().trim(),
    body('skillsRequired').optional().isArray().withMessage('Skills required must be an array'),
    body('skillsRequired.*').optional().trim().notEmpty().withMessage('Each skill must be a non-empty string'),
    body('responsibilities').optional().isArray().withMessage('Responsibilities must be an array'),
    body('responsibilities.*').optional().trim().notEmpty().withMessage('Each responsibility must be a non-empty string'),
    body('qualifications').optional().isArray().withMessage('Qualifications must be an array'),
    body('qualifications.*').optional().trim().notEmpty().withMessage('Each qualification must be a non-empty string'),
    body('displayOrder').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer').toInt(),
    body('isPublished').optional().isBoolean().withMessage('isPublished must be boolean').toBoolean(),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
    body('applicationDeadline').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Application deadline must be a valid date')
];

const reorderJobsValidation = [
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array'),
    body('ids.*').isMongoId().withMessage('Each id must be a valid MongoDB ObjectId')
];

module.exports = { createJobValidation, updateJobValidation, reorderJobsValidation };
