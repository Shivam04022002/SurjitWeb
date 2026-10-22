const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const HTTP_STATUS = require('../constants/httpStatus');
const connection = require('../services/linkedin/linkedinConnection.service');
const configService = require('../services/linkedin/linkedinConfig.service');
const publishing = require('../services/linkedin/linkedinPublish.service');
const { LinkedInError } = require('../services/linkedin/linkedinClient');

// ── Configuration (API Settings page) ─────────────────────────────────────────

// The settings, with the client secret reported only as configured or not.
const getConfig = asyncHandler(async (req, res) => {
    const config = await configService.getConfigView();
    return sendSuccess(res, 'LinkedIn configuration fetched', { config });
});

const saveConfig = asyncHandler(async (req, res) => {
    const { clientId, clientSecret, organizationId, apiVersion, verifyRole } = req.body;
    const result = await configService.saveConfig({ clientId, clientSecret, organizationId, apiVersion, verifyRole }, req.user._id);
    const connectionStatus = await connection.getStatus();
    return sendSuccess(res, 'LinkedIn settings saved', { ...result, connection: connectionStatus });
});

// Readiness when no account is connected; a live, read-only LinkedIn request
// when one is. Never posts anything.
const testConfig = asyncHandler(async (req, res) => {
    const result = await connection.testConfiguration();
    const connectionStatus = await connection.getStatus();
    return sendSuccess(res, result.title, { result, connection: connectionStatus });
});

// ── Connection (API Settings page) ────────────────────────────────────────────

const getConnection = asyncHandler(async (req, res) => {
    const status = await connection.getStatus();
    return sendSuccess(res, 'LinkedIn connection status fetched', { connection: status });
});

// Returns the LinkedIn sign-in URL; the CMS sends the browser there. The
// state inside it is single use and expires in ten minutes.
const startAuthorization = asyncHandler(async (req, res) => {
    try {
        const authorizationUrl = await connection.startAuthorization(req.user._id);
        return sendSuccess(res, 'Continue to LinkedIn to authorize the company page', { authorizationUrl });
    } catch (err) {
        if (err instanceof LinkedInError && err.code === 'NOT_CONFIGURED') {
            return sendError(res, err.message, (err.problems || []).map((p) => ({ field: p.field, code: 'NOT_CONFIGURED', message: p.problem })), HTTP_STATUS.CONFLICT);
        }
        throw err;
    }
});

const CALLBACK_RESULTS = ['connected', 'cancelled', 'invalid_state', 'missing_permission', 'no_role', 'exchange_failed', 'not_configured', 'error'];

// LinkedIn's redirect back. Reached by the browser without the CMS's
// authorization header, so it is protected by the single-use state instead.
// It always ends in a redirect to the API page carrying one fixed word, never
// anything from the request.
const oauthCallback = async (req, res) => {
    let result = 'error';
    try {
        const { code, state, error } = req.query;
        ({ result } = await connection.handleCallback({
            code: typeof code === 'string' ? code : '',
            state: typeof state === 'string' ? state : '',
            error: typeof error === 'string' ? error : ''
        }));
    } catch {
        result = 'error';
    }
    if (!CALLBACK_RESULTS.includes(result)) result = 'error';

    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    if (env.ADMIN_PANEL_URL) {
        const target = new URL('/integrations/api', env.ADMIN_PANEL_URL);
        target.searchParams.set('linkedin', result);
        return res.redirect(303, target.toString());
    }
    // Without ADMIN_PANEL_URL the server does not know where the CMS is.
    const ok = result === 'connected';
    return res.status(ok ? 200 : 400).type('html').send(
        `<!doctype html><meta charset="utf-8"><title>LinkedIn</title><p>${ok
            ? 'LinkedIn is connected. You can close this tab and return to the CMS.'
            : `LinkedIn was not connected (${result}). Return to the CMS API Settings page for details.`}</p>`
    );
};

const disconnect = asyncHandler(async (req, res) => {
    const status = await connection.disconnect();
    return sendSuccess(res, 'LinkedIn disconnected. Stored credentials were deleted.', { connection: status });
});

// ── Sharing a blog (Blogs page) ───────────────────────────────────────────────

const getPreview = asyncHandler(async (req, res) => {
    const preview = await publishing.getPreview(req.params.blogId);
    return sendSuccess(res, 'LinkedIn preview prepared', { preview });
});

const getPublication = asyncHandler(async (req, res) => {
    const publication = await publishing.getPublication(req.params.blogId);
    return sendSuccess(res, 'LinkedIn publication fetched', { publication });
});

// Accepted, not finished: the LinkedIn calls continue in the background and
// the CMS follows them through getPublication.
const publish = asyncHandler(async (req, res) => {
    const publication = await publishing.publish(req.params.blogId, { caption: req.body.caption, confirm: req.body.confirm }, req.user);
    return sendSuccess(res, 'Publishing to LinkedIn', { publication }, HTTP_STATUS.ACCEPTED);
});

const resolve = asyncHandler(async (req, res) => {
    const publication = await publishing.resolveUnknown(req.params.blogId, { outcome: req.body.outcome, postUrn: req.body.postUrn }, req.user);
    return sendSuccess(res, 'LinkedIn publication outcome recorded', { publication });
});

module.exports = {
    getConfig,
    saveConfig,
    testConfig,
    getConnection,
    startAuthorization,
    oauthCallback,
    disconnect,
    getPreview,
    getPublication,
    publish,
    resolve
};
