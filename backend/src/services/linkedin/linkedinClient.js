const env = require('../../config/env');

// LinkedIn's REST API, as documented on Microsoft Learn (LinkedIn Marketing,
// versioned APIs, li-lms-2026-10):
//
//   OAuth      POST https://www.linkedin.com/oauth/v2/accessToken
//              (authorization_code, and refresh_token where LinkedIn has
//              enabled programmatic refresh tokens for the app)
//   ACLs       GET  /rest/organizationAcls?q=roleAssignee     r_organization_admin
//   Images     POST /rest/images?action=initializeUpload      w_organization_social
//              PUT  {uploadUrl} with the bytes and the Bearer token
//              GET  /rest/images/{urn}  until status AVAILABLE
//   Posts      POST /rest/posts  → 201, post URN in the x-restli-id header
//
// Every /rest call carries Linkedin-Version (YYYYMM) and
// X-Restli-Protocol-Version: 2.0.0.
//
// Plain fetch, like the Microsoft Graph client. The client secret is only ever
// placed in a token request's form body, and tokens only in an Authorization
// header; neither appears in an error, a log line or a return value other than
// the token exchange itself. LinkedIn's response bodies are read for their
// error code and then dropped — none is passed on.

const OAUTH_BASE = (env.NODE_ENV !== 'production' && process.env.LINKEDIN_OAUTH_BASE) || 'https://www.linkedin.com/oauth/v2';
const API_BASE = (env.NODE_ENV !== 'production' && process.env.LINKEDIN_API_BASE) || 'https://api.linkedin.com';

class LinkedInError extends Error {
    // `ambiguous` marks a request that may have taken effect even though no
    // success came back — the one case that must never be retried blindly.
    constructor(code, message, { status = null, retryAfter = null, ambiguous = false } = {}) {
        super(message);
        this.name = 'LinkedInError';
        this.code = code;
        this.status = status;
        this.retryAfter = retryAfter;
        this.ambiguous = ambiguous;
    }
}

const timeoutSignal = () => AbortSignal.timeout(env.LINKEDIN_TIMEOUT_MS);

const isTimeout = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError';

const readJson = async (res) => {
    try { return await res.json(); } catch { return null; }
};

const retryAfterSeconds = (res) => {
    const n = parseInt(res.headers.get('retry-after') || '', 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

// `cfg` throughout is the resolved configuration from linkedinConfig.service:
// { clientId, clientSecret, redirectUri, apiVersion, ... }.
const restHeaders = (cfg, accessToken, extra = {}) => ({
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': cfg.apiVersion,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra
});

// A refusal from a /rest endpoint, described for the admin. `what` names the
// step ("upload the image", "create the post") so the message says where it
// stopped. LinkedIn's own message is not included: it can echo request data.
const apiError = (res, body, what) => {
    const status = res.status;
    const liCode = typeof body?.code === 'string' ? body.code : (typeof body?.serviceErrorCode === 'number' ? String(body.serviceErrorCode) : '');
    const suffix = liCode ? ` (LinkedIn: ${liCode})` : '';
    if (status === 401) {
        return new LinkedInError('TOKEN_REJECTED', `LinkedIn rejected the stored authorization while trying to ${what}. Reconnect LinkedIn on the API Settings page.${suffix}`, { status });
    }
    if (status === 403) {
        return new LinkedInError('ACCESS_DENIED', `LinkedIn refused to ${what}. The connected member needs an Administrator, Content Admin or Direct Sponsored Content Poster role on the company page, and the app needs the w_organization_social permission.${suffix}`, { status });
    }
    if (status === 429) {
        const wait = retryAfterSeconds(res);
        return new LinkedInError('RATE_LIMITED', `LinkedIn is limiting requests${wait ? `; try again in ${wait} seconds` : '; try again later'}.${suffix}`, { status, retryAfter: wait });
    }
    if (status === 413 || status === 415 || status === 422) {
        return new LinkedInError('IMAGE_REJECTED', `LinkedIn could not accept the featured image while trying to ${what}. Use a JPG, PNG or GIF under 36 million pixels.${suffix}`, { status });
    }
    if (status >= 500) {
        return new LinkedInError('LINKEDIN_UNAVAILABLE', `LinkedIn had a server error while trying to ${what}.${suffix}`, { status });
    }
    return new LinkedInError('REQUEST_REJECTED', `LinkedIn rejected the request to ${what} (HTTP ${status}).${suffix}`, { status });
};

const networkError = (err, what) => (isTimeout(err)
    ? new LinkedInError('TIMEOUT', `LinkedIn did not respond within ${Math.round(env.LINKEDIN_TIMEOUT_MS / 1000)} seconds while trying to ${what}.`)
    : new LinkedInError('NETWORK', `Could not reach LinkedIn to ${what}. Check the server's internet connection.`));

// ── OAuth ─────────────────────────────────────────────────────────────────────

const authorizationUrl = (cfg, { state }) => {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        state,
        scope: cfg.scopes.join(' ')
    });
    return `${OAUTH_BASE}/authorization?${params.toString()}`;
};

// LinkedIn answers token errors with { error, error_description }. The
// description can quote the request, so only the error name is kept.
const tokenError = (status, body) => {
    const name = typeof body?.error === 'string' ? body.error : '';
    const desc = typeof body?.error_description === 'string' ? body.error_description.toLowerCase() : '';
    if (name === 'invalid_redirect_uri' || desc.includes('redirect uri')) {
        return new LinkedInError('REDIRECT_URI_MISMATCH', 'LinkedIn did not accept the redirect URI, or the authorization code expired. Check that LINKEDIN_REDIRECT_URI exactly matches the one registered on the LinkedIn app, then connect again.', { status });
    }
    if (desc.includes('expired') || desc.includes('revoked') || desc.includes('not found') || name === 'invalid_grant') {
        return new LinkedInError('CODE_OR_TOKEN_INVALID', 'LinkedIn reported the authorization as invalid, expired or revoked. Connect again.', { status });
    }
    if (name === 'invalid_client' || status === 401) {
        return new LinkedInError('INVALID_CLIENT', 'LinkedIn rejected the app credentials. Check LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET on the server.', { status });
    }
    if (status === 429) return new LinkedInError('RATE_LIMITED', 'LinkedIn is limiting sign-in requests. Try again later.', { status });
    if (status >= 500) return new LinkedInError('LINKEDIN_UNAVAILABLE', 'LinkedIn sign-in is temporarily unavailable. Try again shortly.', { status });
    return new LinkedInError('TOKEN_REQUEST_FAILED', `LinkedIn refused the token request${name ? ` (${name})` : ''}.`, { status });
};

const parseTokenResponse = (body, status) => {
    if (!body || typeof body.access_token !== 'string' || !body.access_token) {
        throw new LinkedInError('MALFORMED_RESPONSE', 'LinkedIn returned no access token.', { status });
    }
    const expiresIn = Number(body.expires_in);
    const refreshExpiresIn = Number(body.refresh_token_expires_in);
    return {
        accessToken: body.access_token,
        expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null,
        refreshToken: typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : null,
        refreshExpiresIn: Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0 ? refreshExpiresIn : null,
        // Space delimited per the docs; commas tolerated.
        scopes: typeof body.scope === 'string' ? body.scope.split(/[\s,]+/).filter(Boolean) : null
    };
};

const tokenRequest = async (form, what) => {
    let res;
    try {
        res = await fetch(`${OAUTH_BASE}/accessToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(form).toString(),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, what);
    }
    const body = await readJson(res);
    if (!res.ok) throw tokenError(res.status, body);
    return parseTokenResponse(body, res.status);
};

const exchangeCode = (cfg, code) => tokenRequest({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri
}, 'exchange the authorization code');

const refreshAccessToken = (cfg, refreshToken) => tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret
}, 'refresh the access token');

// ── Organization access control ───────────────────────────────────────────────

// The member's approved roles, as [{ role, organization }]. The docs show the
// organization under either `organization` or `organizationTarget`, so both
// are read.
const getApprovedRoles = async (cfg, accessToken) => {
    let res;
    try {
        res = await fetch(`${API_BASE}/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=100`, {
            headers: restHeaders(cfg, accessToken),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, 'check the page roles');
    }
    const body = await readJson(res);
    if (!res.ok) throw apiError(res, body, 'check the page roles');
    if (!Array.isArray(body?.elements)) {
        throw new LinkedInError('MALFORMED_RESPONSE', 'LinkedIn returned an unexpected answer to the page-role check.', { status: res.status });
    }
    return body.elements.map((e) => ({
        role: typeof e?.role === 'string' ? e.role : '',
        organization: typeof e?.organization === 'string' ? e.organization : (typeof e?.organizationTarget === 'string' ? e.organizationTarget : ''),
        roleAssignee: typeof e?.roleAssignee === 'string' ? e.roleAssignee : '',
        state: typeof e?.state === 'string' ? e.state : ''
    }));
};

// ── Images ────────────────────────────────────────────────────────────────────

// The upload URL comes from LinkedIn and receives the Bearer token, so it is
// checked to be an HTTPS LinkedIn address before anything is sent to it.
const isLinkedInUploadUrl = (value) => {
    try {
        const u = new URL(value);
        if (env.NODE_ENV !== 'production' && process.env.LINKEDIN_API_BASE && value.startsWith(process.env.LINKEDIN_API_BASE)) return true;
        return u.protocol === 'https:' && (u.hostname === 'linkedin.com' || u.hostname.endsWith('.linkedin.com'));
    } catch {
        return false;
    }
};

const initializeImageUpload = async (cfg, accessToken, ownerUrn) => {
    let res;
    try {
        res = await fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
            method: 'POST',
            headers: restHeaders(cfg, accessToken, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, 'start the image upload');
    }
    const body = await readJson(res);
    if (!res.ok) throw apiError(res, body, 'start the image upload');
    const value = body?.value;
    if (!value || typeof value.uploadUrl !== 'string' || typeof value.image !== 'string' || !value.image.startsWith('urn:li:image:')) {
        throw new LinkedInError('MALFORMED_RESPONSE', 'LinkedIn returned an unexpected answer when starting the image upload.', { status: res.status });
    }
    if (!isLinkedInUploadUrl(value.uploadUrl)) {
        throw new LinkedInError('MALFORMED_RESPONSE', 'LinkedIn returned an upload address that is not a LinkedIn HTTPS address; nothing was sent to it.', { status: res.status });
    }
    return { uploadUrl: value.uploadUrl, imageUrn: value.image };
};

const uploadImage = async (accessToken, uploadUrl, buffer, contentType) => {
    let res;
    try {
        res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
            body: buffer,
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, 'upload the image');
    }
    if (!res.ok) throw apiError(res, await readJson(res), 'upload the image');
    return { status: res.status };
};

// One status read: WAITING_UPLOAD, PROCESSING, AVAILABLE or PROCESSING_FAILED.
const getImageStatus = async (cfg, accessToken, imageUrn) => {
    let res;
    try {
        res = await fetch(`${API_BASE}/rest/images/${encodeURIComponent(imageUrn)}`, {
            headers: restHeaders(cfg, accessToken),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, 'check the image');
    }
    const body = await readJson(res);
    if (!res.ok) throw apiError(res, body, 'check the image');
    if (typeof body?.status !== 'string') {
        throw new LinkedInError('MALFORMED_RESPONSE', 'LinkedIn returned an unexpected answer when checking the image.', { status: res.status });
    }
    return body.status;
};

// ── Posts ─────────────────────────────────────────────────────────────────────

// Creates the post. Anything short of a definite answer from LinkedIn — a
// timeout, a dropped connection, a server error, or a 201 without the post's
// URN — is reported as ambiguous: the post may exist, and the caller must not
// try again on its own.
const createPost = async (cfg, accessToken, post) => {
    let res;
    try {
        res = await fetch(`${API_BASE}/rest/posts`, {
            method: 'POST',
            headers: restHeaders(cfg, accessToken, { 'Content-Type': 'application/json' }),
            body: JSON.stringify(post),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw new LinkedInError('POST_UNCONFIRMED', isTimeout(err)
            ? 'LinkedIn did not answer the post request in time, so the post may or may not have been published.'
            : 'The connection to LinkedIn dropped during the post request, so the post may or may not have been published.', { ambiguous: true });
    }
    if (res.status >= 500) {
        throw new LinkedInError('POST_UNCONFIRMED', `LinkedIn answered the post request with a server error (HTTP ${res.status}), so the post may or may not have been published.`, { status: res.status, ambiguous: true });
    }
    if (!res.ok) throw apiError(res, await readJson(res), 'create the post');
    const postUrn = res.headers.get('x-restli-id') || '';
    if (!/^urn:li:(share|ugcPost):[0-9]+$/.test(postUrn)) {
        throw new LinkedInError('POST_ID_MISSING', 'LinkedIn accepted the post request but did not return a recognisable post ID, so it may have been published.', { status: res.status, ambiguous: true });
    }
    return { postUrn };
};

module.exports = {
    LinkedInError,
    authorizationUrl,
    exchangeCode,
    refreshAccessToken,
    getApprovedRoles,
    initializeImageUpload,
    uploadImage,
    getImageStatus,
    createPost,
    isLinkedInUploadUrl
};
