const express = require('express');
const auth = require('../middleware/auth');
const { canView: viewPage, canEdit: editPage } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { emailTestLimiter } = require('../middleware/rateLimiters');
const controller = require('../controllers/emailSettings.controller');
const {
    saveEmailSettingsValidation, saveProviderValidation, saveRecipientsValidation, saveProductRulesValidation,
    sendTestEmailValidation, listNotificationsValidation, notificationIdValidation
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
// The two halves of the same configuration, saved from their own pages: the
// Microsoft credentials from the API page, the recipients from Email Settings.
// Each leaves the other half untouched.
router.put('/provider', canManage, saveProviderValidation, validate, controller.saveProvider);
router.put('/recipients', canManage, saveRecipientsValidation, validate, controller.saveRecipients);
// Which products' new loan applications are emailed (empty: all of them).
router.put('/product-rules', canManage, saveProductRulesValidation, validate, controller.saveProductRules);
router.post('/test-connection', canManage, emailTestLimiter, controller.testConnection);
router.post('/test-email', canManage, emailTestLimiter, sendTestEmailValidation, validate, controller.sendTestEmail);

// Email Delivery Log. Reading it is a view; bringing a scheduled retry
// forward is an edit, and calls Microsoft, so it shares the test limiter.
router.get('/notifications', canRead, listNotificationsValidation, validate, controller.listNotifications);
// One record in full: delivery history always; the application and a
// regenerated email preview only with Loan Applications view as well.
router.get('/notifications/:id', canRead, notificationIdValidation, validate, controller.getNotification);
router.post('/notifications/:id/retry', canManage, emailTestLimiter, notificationIdValidation, validate, controller.retryNotification);

module.exports = router;
