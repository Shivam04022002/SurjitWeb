const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { emailTestLimiter } = require('../middleware/rateLimiters');
const controller = require('../controllers/emailSettings.controller');
const {
    saveEmailSettingsValidation, sendTestEmailValidation, listNotificationsValidation, notificationIdValidation
} = require('../validators/emailSettings.validator');

const router = express.Router();

// Email credentials sit under the API Settings page's permission, like the
// Gemini and Pexels keys. Reading the configuration is a view (the secret is
// never returned); changing it, and both tests, are edits — a test email is
// real mail sent as the organization.
const canRead = [auth, viewPage('integrations')];
const canManage = [auth, editPage('integrations')];

router.get('/', canRead, controller.getSettings);
router.put('/', canManage, saveEmailSettingsValidation, validate, controller.saveSettings);
router.post('/test-connection', canManage, emailTestLimiter, controller.testConnection);
router.post('/test-email', canManage, emailTestLimiter, sendTestEmailValidation, validate, controller.sendTestEmail);

// Email Delivery Log. Reading it is a view; bringing a scheduled retry
// forward is an edit, and calls Microsoft, so it shares the test limiter.
router.get('/notifications', canRead, listNotificationsValidation, validate, controller.listNotifications);
router.post('/notifications/:id/retry', canManage, emailTestLimiter, notificationIdValidation, validate, controller.retryNotification);

module.exports = router;
