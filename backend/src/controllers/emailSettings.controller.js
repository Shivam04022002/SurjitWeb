const emailConfig = require('../services/email/emailConfig.service');
const notificationHistory = require('../services/email/notificationHistory.service');
const { sendSuccess } = require('../utils/response');
const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { holds } = require('../middleware/permission');
const { viewPermission } = require('../constants/permissions');

// Applicant data in the delivery log (name, product, the email preview) needs
// Loan Applications view as well as the log's own API Settings view. Decided
// here from the signed-in admin's role, never from the request.
const mayReadApplicants = (req) => holds(req.user, viewPermission('loanApplications'));

// Every response here is built by emailConfig — the client secret's last four
// characters at most, never the secret or its ciphertext.

const getSettings = asyncHandler(async (req, res) => {
    const config = await emailConfig.publicStatus();
    return sendSuccess(res, 'Email settings fetched', { config });
});

const saveSettings = asyncHandler(async (req, res) => {
    const config = await emailConfig.save(req.body, req.user._id);
    return sendSuccess(res, 'Email settings saved', { config });
});

// The API page's Email API card: credentials and sender only.
const saveProvider = asyncHandler(async (req, res) => {
    const config = await emailConfig.saveProvider(req.body, req.user._id);
    return sendSuccess(res, 'Email provider settings saved', { config });
});

// Email Settings: recipients and the notification preference only.
const saveRecipients = asyncHandler(async (req, res) => {
    const config = await emailConfig.saveRecipients(req.body, req.user._id);
    return sendSuccess(res, 'Email notification settings saved', { config });
});

// A failed test is a result, not an error: the request worked and the answer
// is "no". The page reads result.ok, as it does for the Gemini test.
const testConnection = asyncHandler(async (req, res) => {
    const result = await emailConfig.testConnection();
    const config = await emailConfig.publicStatus();
    return sendSuccess(res, result.ok ? 'Connection successful' : 'Connection failed', { result, config });
});

const sendTestEmail = asyncHandler(async (req, res) => {
    const result = await emailConfig.sendTestEmail(req.body.recipient, req.user);
    const config = await emailConfig.publicStatus();
    return sendSuccess(res, result.ok ? 'Test email sent' : 'Test email failed', { result, config });
});

// ── Email Delivery Log ───────────────────────────────────────────────────────
// Rows are built by notificationHistory.viewOf(): reference, status, counts,
// times and an outcome code. No applicant data or recipient address.

// Filters come from matchedData: the validated, converted values. Express 5's
// req.query is read-only, so the validator's conversions are not visible there.
const listNotifications = asyncHandler(async (req, res) => {
    const q = matchedData(req, { locations: ['query'] });
    const result = await notificationHistory.list({
        status: q.status || undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        page: q.page || 1,
        limit: q.limit || 20,
        includeApplicant: await mayReadApplicants(req)
    });
    return sendSuccess(res, 'Email notifications fetched', result);
});

const getNotification = asyncHandler(async (req, res) => {
    const result = await notificationHistory.detail(req.params.id, { includeApplicant: await mayReadApplicants(req) });
    return sendSuccess(res, 'Email notification fetched', result);
});

const retryNotification = asyncHandler(async (req, res) => {
    const notification = await notificationHistory.retryNow(req.params.id, req.user._id);
    return sendSuccess(res, notification.status === 'sent' ? 'Email accepted by Microsoft' : 'Retry attempted', { notification });
});

module.exports = { getSettings, saveSettings, saveProvider, saveRecipients, testConnection, sendTestEmail, listNotifications, getNotification, retryNotification };
