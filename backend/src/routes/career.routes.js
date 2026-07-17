const express = require('express');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');

const settingsController = require('../controllers/career/settings.controller');
const jobsController = require('../controllers/career/jobs.controller');
const applicationsController = require('../controllers/career/applications.controller');

const { updateSettingsValidation } = require('../validators/careers/settings.validator');
const { createJobValidation, updateJobValidation, reorderJobsValidation } = require('../validators/careers/jobs.validator');
const { submitApplicationValidation, updateStatusValidation } = require('../validators/careers/applications.validator');

const router = express.Router();

const settingsImageUpload = createUpload({ folder: 'career', fileTypes: 'images' }).fields([
    { name: 'heroBannerImage', maxCount: 1 },
    { name: 'whyJoinImage', maxCount: 1 },
    { name: 'seo.ogImage', maxCount: 1 }
]);

const resumeUpload = createUpload({ folder: 'resumes', fileTypes: 'documents', maxSize: 10 * 1024 * 1024 }).single('resume');

const adminOnly = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR)];
const readAccess = [auth, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.CONTENT_MANAGER)];

// ── Career Settings ────────────────────────────────────────────────────────────
router.get('/settings', readAccess, settingsController.getSettings);
router.put('/settings', adminOnly, settingsImageUpload, updateSettingsValidation, validate, settingsController.updateSettings);

// ── Jobs ───────────────────────────────────────────────────────────────────────
router.get('/jobs', readAccess, jobsController.getAllJobs);
router.patch('/jobs/reorder', adminOnly, reorderJobsValidation, validate, jobsController.reorderJobs);
router.get('/jobs/:id', readAccess, jobsController.getJobById);
router.post('/jobs', adminOnly, createJobValidation, validate, jobsController.createJob);
router.put('/jobs/:id', adminOnly, updateJobValidation, validate, jobsController.updateJob);
router.delete('/jobs/:id', [auth, authorize(ROLES.SUPER_ADMIN)], jobsController.deleteJob);
router.patch('/jobs/:id/status', adminOnly, jobsController.toggleJobStatus);
router.patch('/jobs/:id/publish', adminOnly, jobsController.toggleJobPublish);
router.post('/jobs/:id/duplicate', adminOnly, jobsController.duplicateJob);

// ── Applications ───────────────────────────────────────────────────────────────
router.get('/applications/export', readAccess, applicationsController.exportApplications);
router.get('/applications', readAccess, applicationsController.getAllApplications);
router.get('/applications/:id', readAccess, applicationsController.getApplicationById);
router.post('/applications', resumeUpload, submitApplicationValidation, validate, applicationsController.submitApplication);
router.patch('/applications/:id/status', adminOnly, updateStatusValidation, validate, applicationsController.updateApplicationStatus);
router.delete('/applications/:id', [auth, authorize(ROLES.SUPER_ADMIN)], applicationsController.deleteApplication);

module.exports = router;
