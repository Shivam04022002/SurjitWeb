const express = require('express');
const validate = require('../middleware/validate');
const { createUpload } = require('../middleware/upload');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const { blockProtectedFields } = require('../middleware/restrictFields');

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

// Editing an existing record is open to Content Manager; creating,
// deleting, publishing, changing status and reordering are not. The
// blockProtectedFields guard stops an edit body reaching those anyway.

// ── Career Settings ────────────────────────────────────────────────────────────
router.get('/settings', [auth, viewPage('careerSettings')], settingsController.getSettings);
router.put('/settings', [auth, editPage('careerSettings')], blockProtectedFields, settingsImageUpload, updateSettingsValidation, validate, settingsController.updateSettings);

// ── Jobs ───────────────────────────────────────────────────────────────────────
router.get('/jobs', [auth, viewPage('jobs')], jobsController.getAllJobs);
router.patch('/jobs/reorder', [auth, editPage('jobs')], reorderJobsValidation, validate, jobsController.reorderJobs);
router.get('/jobs/:id', [auth, viewPage('jobs')], jobsController.getJobById);
router.post('/jobs', [auth, editPage('jobs')], createJobValidation, validate, jobsController.createJob);
router.put('/jobs/:id', [auth, editPage('jobs')], blockProtectedFields, updateJobValidation, validate, jobsController.updateJob);
router.delete('/jobs/:id', [auth, editPage('jobs')], jobsController.deleteJob);
router.patch('/jobs/:id/status', [auth, editPage('jobs')], jobsController.toggleJobStatus);
router.patch('/jobs/:id/publish', [auth, editPage('jobs')], jobsController.toggleJobPublish);
router.post('/jobs/:id/duplicate', [auth, editPage('jobs')], jobsController.duplicateJob);

// ── Applications ───────────────────────────────────────────────────────────────
router.get('/applications/export', [auth, viewPage('jobApplications')], applicationsController.exportApplications);
router.get('/applications', [auth, viewPage('jobApplications')], applicationsController.getAllApplications);
router.get('/applications/:id', [auth, viewPage('jobApplications')], applicationsController.getApplicationById);
router.post('/applications', resumeUpload, submitApplicationValidation, validate, applicationsController.submitApplication);
router.patch('/applications/:id/status', [auth, editPage('jobApplications')], updateStatusValidation, validate, applicationsController.updateApplicationStatus);
router.delete('/applications/:id', [auth, editPage('jobApplications')], applicationsController.deleteApplication);

module.exports = router;
