const crypto = require('crypto');
const LinkedInConnection = require('../../models/LinkedInConnection');
const { SINGLETON_KEY } = require('../../models/LinkedInConnection');
const { encrypt, decrypt } = require('../../utils/secretBox');
const logger = require('../../utils/logger');
const client = require('./linkedinClient');
const configService = require('./linkedinConfig.service');

const { LinkedInError } = client;
const { REQUIRED_SCOPE } = configService;

// The CMS's authorization to post as the company page: starting and finishing
// LinkedIn's authorization-code flow, reporting the connection's state,
// testing the configuration, and handing a usable access token to the
// publishing service. This module and the publishing service are the only
// code that decrypts a LinkedIn token.

const ROLE_CHECK_SCOPES = ['r_organization_admin', 'rw_organization_admin'];
// Company-page roles allowed to post as the page (Posts API documentation;
// the ACL documentation spells the content role CONTENT_ADMINISTRATOR).
const POSTING_ROLES = ['ADMINISTRATOR', 'CONTENT_ADMIN', 'CONTENT_ADMINISTRATOR', 'DIRECT_SPONSORED_CONTENT_POSTER'];
const STATE_TTL_MS = 10 * 60 * 1000;
// A token this close to expiry is refreshed first (when refresh is available),
// or reported as needing a reconnect, so a post never starts on a dying token.
const EXPIRY_MARGIN_MS = 24 * 60 * 60 * 1000;

const hashState = (state) => crypto.createHash('sha256').update(state).digest('hex');

const organizationUrn = (id) => `urn:li:organization:${id}`;

const hasRoleCheckScope = (scopes) => ROLE_CHECK_SCOPES.some((s) => scopes.includes(s));

// ── Status ────────────────────────────────────────────────────────────────────

const getDocument = () => LinkedInConnection.findOne({ key: SINGLETON_KEY })
    .populate('connectedBy', 'name email');

const hasToken = (doc) => !!(doc && doc.connectedAt);

// One word for the admin screens:
//   not_configured       settings missing or invalid — nobody can connect yet
//   not_connected        configured, never connected or disconnected
//   reconnect_required   LinkedIn refused the token, it expired with no
//                        refresh available, or the app or page changed
//   connected            ready to publish
const describe = (doc, cfg, now = new Date()) => {
    const base = {
        configured: cfg.complete,
        configurationProblems: cfg.problems,
        organizationId: cfg.organizationId,
        organizationUrn: cfg.organizationId ? organizationUrn(cfg.organizationId) : '',
        redirectUri: cfg.redirectUri || '',
        apiVersion: cfg.apiVersion,
        apiVersionWarning: configService.versionWarning(cfg.apiVersion, now),
        requestedScopes: cfg.scopes,
        lastConfigTest: doc?.lastConfigTest?.at ? doc.lastConfigTest : null
    };
    if (!hasToken(doc)) {
        return {
            ...base,
            state: cfg.complete ? 'not_connected' : 'not_configured',
            lastAttempt: doc?.lastAttempt?.at ? doc.lastAttempt : null
        };
    }

    const accessExpired = doc.accessTokenExpiresAt && doc.accessTokenExpiresAt.getTime() <= now.getTime();
    const refreshUsable = !!(doc.refreshTokenExpiresAt && doc.refreshTokenExpiresAt.getTime() > now.getTime());
    let reconnectCode = doc.reconnectRequired?.code || '';
    if (!reconnectCode && doc.connectedClientId && cfg.clientId && doc.connectedClientId !== cfg.clientId) reconnectCode = 'CLIENT_CHANGED';
    if (!reconnectCode && doc.organizationId !== cfg.organizationId) reconnectCode = 'ORGANIZATION_CHANGED';
    if (!reconnectCode && accessExpired && !refreshUsable) reconnectCode = 'TOKEN_EXPIRED';
    if (!reconnectCode && !doc.scopes.includes(REQUIRED_SCOPE)) reconnectCode = 'MISSING_PERMISSION';

    let state = 'connected';
    if (!cfg.complete) state = 'not_configured';
    else if (reconnectCode) state = 'reconnect_required';

    return {
        ...base,
        state,
        reconnectCode,
        connectedOrganizationId: doc.organizationId,
        connectedAt: doc.connectedAt,
        connectedBy: doc.connectedBy ? { name: doc.connectedBy.name, email: doc.connectedBy.email } : null,
        grantedScopes: doc.scopes,
        accessTokenExpiresAt: doc.accessTokenExpiresAt,
        refreshTokenExpiresAt: doc.refreshTokenExpiresAt,
        refreshAvailable: refreshUsable,
        roleVerification: {
            status: doc.roleVerification?.status || 'not_verified',
            role: doc.roleVerification?.role || '',
            checkedAt: doc.roleVerification?.checkedAt || null
        },
        lastAttempt: doc.lastAttempt?.at ? doc.lastAttempt : null
    };
};

const getStatus = async () => describe(await getDocument(), await configService.getEffectiveConfig());

// ── Authorization flow ────────────────────────────────────────────────────────

// Starts a connection: a fresh 256-bit state, stored only as its hash with the
// admin who started it and a ten-minute expiry, replacing any earlier attempt.
// Returns the LinkedIn URL to send the browser to.
const startAuthorization = async (adminId) => {
    const cfg = await configService.getEffectiveConfig();
    if (!cfg.complete) {
        const err = new LinkedInError('NOT_CONFIGURED', 'The LinkedIn settings are incomplete. Complete and save them first.');
        err.problems = cfg.problems;
        throw err;
    }
    const state = crypto.randomBytes(32).toString('base64url');
    await LinkedInConnection.updateOne(
        { key: SINGLETON_KEY },
        {
            $set: {
                pendingAuthorization: {
                    stateHash: hashState(state),
                    startedBy: adminId,
                    expiresAt: new Date(Date.now() + STATE_TTL_MS)
                }
            },
            $setOnInsert: { key: SINGLETON_KEY }
        },
        { upsert: true }
    );
    return client.authorizationUrl(cfg, { state });
};

// Consumes the pending state if — and only if — it matches and has not
// expired. One atomic update, so a state can never be used twice, even by two
// callbacks arriving together. Returns the admin who started the flow.
const consumeState = async (state) => {
    if (typeof state !== 'string' || state.length < 20 || state.length > 200) return null;
    const doc = await LinkedInConnection.findOneAndUpdate(
        {
            key: SINGLETON_KEY,
            'pendingAuthorization.stateHash': hashState(state),
            'pendingAuthorization.expiresAt': { $gt: new Date() }
        },
        { $set: { pendingAuthorization: null } },
        { new: false }
    ).select('+pendingAuthorization');
    return doc?.pendingAuthorization?.startedBy || null;
};

const recordAttempt = (ok, code) => LinkedInConnection.updateOne(
    { key: SINGLETON_KEY },
    { $set: { lastAttempt: { at: new Date(), ok, code } } }
);

// The member's approved posting role on the configured page, read from
// LinkedIn's organization ACLs. Throws NO_ORGANIZATION_ROLE when there is none.
const readPostingRole = async (cfg, accessToken) => {
    const roles = await client.getApprovedRoles(cfg, accessToken);
    const target = organizationUrn(cfg.organizationId);
    const match = roles.find((r) => r.organization === target && POSTING_ROLES.includes(r.role) && (r.state === '' || r.state === 'APPROVED'));
    if (!match) {
        throw new LinkedInError('NO_ORGANIZATION_ROLE', `The LinkedIn member has no approved Administrator, Content Admin or Direct Sponsored Content Poster role on company page ${cfg.organizationId}. Sign in as a page admin, or have one grant the role.`);
    }
    return { status: 'verified', role: match.role, memberUrn: match.roleAssignee };
};

// Confirms the member may post as the configured page, when the granted
// scopes allow the check.
const verifyRole = async (cfg, accessToken, scopes) => {
    if (!hasRoleCheckScope(scopes)) return { status: 'not_verified', role: '', memberUrn: '' };
    return readPostingRole(cfg, accessToken);
};

// Handles LinkedIn's redirect back. Never throws: every outcome is a short,
// fixed result code for the admin panel, so nothing from the request (and
// above all not the code or state) is reflected or logged.
//
//   connected | cancelled | invalid_state | missing_permission | no_role |
//   exchange_failed | not_configured | error
const handleCallback = async ({ code, state, error }) => {
    try {
        const cfg = await configService.getEffectiveConfig();
        if (!cfg.complete) return { result: 'not_configured' };

        // Denial and cancellation still carry the state; consume it so the
        // attempt cannot be resumed, and report the cancellation only for a
        // state we issued.
        const startedBy = await consumeState(state);
        if (!startedBy) {
            await recordAttempt(false, 'INVALID_STATE');
            return { result: 'invalid_state' };
        }
        if (error) {
            const cancelled = error === 'user_cancelled_login' || error === 'user_cancelled_authorize';
            await recordAttempt(false, cancelled ? 'CANCELLED' : 'AUTHORIZATION_DENIED');
            return { result: 'cancelled' };
        }
        if (typeof code !== 'string' || !code || code.length > 2000) {
            await recordAttempt(false, 'MISSING_CODE');
            return { result: 'exchange_failed' };
        }

        const token = await client.exchangeCode(cfg, code);
        // When LinkedIn omits the scope list, the requested scopes were all
        // granted (the member cannot pick individual scopes).
        const scopes = token.scopes || cfg.scopes;
        if (!scopes.includes(REQUIRED_SCOPE)) {
            await recordAttempt(false, 'MISSING_PERMISSION');
            return { result: 'missing_permission' };
        }

        const role = await verifyRole(cfg, token.accessToken, scopes);
        const now = Date.now();
        await LinkedInConnection.updateOne(
            { key: SINGLETON_KEY },
            {
                $set: {
                    encryptedAccessToken: encrypt(token.accessToken),
                    accessTokenExpiresAt: token.expiresIn ? new Date(now + token.expiresIn * 1000) : null,
                    encryptedRefreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
                    refreshTokenExpiresAt: token.refreshToken && token.refreshExpiresIn ? new Date(now + token.refreshExpiresIn * 1000) : null,
                    scopes,
                    organizationId: cfg.organizationId,
                    connectedClientId: cfg.clientId,
                    roleVerification: { ...role, checkedAt: new Date() },
                    connectedAt: new Date(),
                    connectedBy: startedBy,
                    reconnectRequired: { code: '', at: null },
                    lastAttempt: { at: new Date(), ok: true, code: 'CONNECTED' }
                }
            }
        );
        logger.info('LinkedIn connected', { organizationId: cfg.organizationId, by: String(startedBy), roleVerified: role.status });
        return { result: 'connected' };
    } catch (err) {
        const codeName = err instanceof LinkedInError ? err.code : 'UNEXPECTED';
        logger.warn('LinkedIn connection failed', { code: codeName, status: err?.status || null });
        try { await recordAttempt(false, codeName); } catch { /* reporting only */ }
        if (codeName === 'NO_ORGANIZATION_ROLE') return { result: 'no_role' };
        if (err instanceof LinkedInError) return { result: 'exchange_failed' };
        return { result: 'error' };
    }
};

// ── Disconnect ────────────────────────────────────────────────────────────────

// Deletes the stored tokens, so nothing in the CMS can post until someone
// connects again. The saved app settings are kept. LinkedIn keeps its record
// of the app's authorization until the member removes it from their LinkedIn
// account settings.
const disconnect = async () => {
    await LinkedInConnection.updateOne(
        { key: SINGLETON_KEY },
        {
            $set: {
                encryptedAccessToken: null,
                accessTokenExpiresAt: null,
                encryptedRefreshToken: null,
                refreshTokenExpiresAt: null,
                scopes: [],
                organizationId: '',
                connectedClientId: '',
                roleVerification: { status: 'not_verified', role: '', memberUrn: '', checkedAt: null },
                connectedAt: null,
                connectedBy: null,
                reconnectRequired: { code: '', at: null },
                pendingAuthorization: null
            }
        }
    );
    return getStatus();
};

// ── Tokens for publishing ─────────────────────────────────────────────────────

const markReconnectRequired = (code) => LinkedInConnection.updateOne(
    { key: SINGLETON_KEY },
    { $set: { reconnectRequired: { code, at: new Date() } } }
);

// An access token ready to use, with the configuration it belongs to —
// refreshed first when near expiry and LinkedIn issued a refresh token.
// Throws (NOT_CONFIGURED / NOT_CONNECTED / RECONNECT_REQUIRED) when there is
// no usable token; the caller reports that rather than calling LinkedIn.
const getUsableAccessToken = async () => {
    const cfg = await configService.getEffectiveConfig();
    const doc = await LinkedInConnection.findOne({ key: SINGLETON_KEY })
        .select('+encryptedAccessToken +encryptedRefreshToken');
    const status = describe(doc, cfg);
    if (status.state === 'not_configured') {
        throw new LinkedInError('NOT_CONFIGURED', 'The LinkedIn settings are incomplete. Complete them on the API Settings page.');
    }
    if (status.state === 'not_connected') {
        throw new LinkedInError('NOT_CONNECTED', 'LinkedIn is not connected. Connect it on the API Settings page first.');
    }
    if (status.state === 'reconnect_required') {
        throw new LinkedInError('RECONNECT_REQUIRED', 'The LinkedIn connection must be renewed. Reconnect it on the API Settings page.');
    }

    const accessToken = decrypt(doc.encryptedAccessToken);
    if (!accessToken) {
        await markReconnectRequired('TOKEN_UNREADABLE');
        throw new LinkedInError('RECONNECT_REQUIRED', 'The stored LinkedIn authorization can no longer be decrypted (the server encryption key changed). Reconnect LinkedIn.');
    }
    const ready = (token) => ({ accessToken: token, organizationId: doc.organizationId, scopes: doc.scopes, cfg });

    const expiresAt = doc.accessTokenExpiresAt ? doc.accessTokenExpiresAt.getTime() : null;
    if (expiresAt === null || expiresAt - EXPIRY_MARGIN_MS > Date.now()) return ready(accessToken);

    const refreshToken = status.refreshAvailable ? decrypt(doc.encryptedRefreshToken) : null;
    if (!refreshToken) {
        if (expiresAt > Date.now()) return ready(accessToken);
        await markReconnectRequired('TOKEN_EXPIRED');
        throw new LinkedInError('RECONNECT_REQUIRED', 'The LinkedIn authorization has expired and LinkedIn has not enabled automatic refresh for this app. Reconnect LinkedIn.');
    }

    try {
        const fresh = await client.refreshAccessToken(cfg, refreshToken);
        const now = Date.now();
        const update = {
            encryptedAccessToken: encrypt(fresh.accessToken),
            accessTokenExpiresAt: fresh.expiresIn ? new Date(now + fresh.expiresIn * 1000) : null
        };
        if (fresh.refreshToken) {
            update.encryptedRefreshToken = encrypt(fresh.refreshToken);
            if (fresh.refreshExpiresIn) update.refreshTokenExpiresAt = new Date(now + fresh.refreshExpiresIn * 1000);
        }
        await LinkedInConnection.updateOne({ key: SINGLETON_KEY }, { $set: update });
        return ready(fresh.accessToken);
    } catch (err) {
        if (err instanceof LinkedInError && (err.code === 'CODE_OR_TOKEN_INVALID' || err.code === 'INVALID_CLIENT')) {
            await markReconnectRequired('REFRESH_REJECTED');
            throw new LinkedInError('RECONNECT_REQUIRED', 'LinkedIn refused to refresh the authorization. Reconnect LinkedIn.');
        }
        // A network or server problem says nothing about the token; use the
        // current one while it is still valid.
        if (expiresAt > Date.now()) return ready(accessToken);
        throw err;
    }
};

// ── Test configuration ────────────────────────────────────────────────────────

const FIELD_LABELS = {
    clientId: 'Client ID', clientSecret: 'Client secret', organizationId: 'Company page ID',
    apiVersion: 'API version', scopes: 'Scopes', redirectUri: 'OAuth redirect URI'
};

// What "Test Configuration" reports. Two kinds of test, never confused:
//
//   readiness  local checks only — LinkedIn was not contacted. Used whenever
//              there is no usable connection. It cannot prove the client ID
//              and secret are right; LinkedIn only checks those at Connect.
//   live       an authorized request to LinkedIn with the stored token, using
//              the configured API version: the member's page roles.
//
// outcome: CONFIG_INCOMPLETE | AUTHORIZATION_REQUIRED | RECONNECT_REQUIRED |
//          CONNECTED_AUTHORIZED | ORGANIZATION_NOT_VERIFIED |
//          NO_ORGANIZATION_ROLE | PUBLISHING_PERMISSION_MISSING |
//          API_REQUEST_FAILED
const testConfiguration = async () => {
    const cfg = await configService.getEffectiveConfig();
    const checks = [];
    const check = (id, label, status, message) => checks.push({ id, label, status, message });

    for (const field of ['clientId', 'clientSecret', 'organizationId', 'apiVersion', 'scopes']) {
        const problem = cfg.problems.find((p) => p.field === field);
        check(field, FIELD_LABELS[field], problem ? 'fail' : 'pass', problem ? `${FIELD_LABELS[field]} ${problem.problem}.` : 'Present and valid.');
    }
    const uriProblem = cfg.problems.find((p) => p.field === 'redirectUri');
    check('redirectUri', FIELD_LABELS.redirectUri, uriProblem ? 'fail' : 'pass', uriProblem
        ? `The redirect URI ${uriProblem.problem}.`
        : `This exact address is sent to LinkedIn: ${cfg.redirectUri}. LinkedIn does not let it be read back, so it must match a Redirect URL on the app's Auth tab character for character.`);
    const apiWarning = configService.versionWarning(cfg.apiVersion);
    if (apiWarning) check('apiVersionAge', 'API version age', 'warn', apiWarning);

    const finish = async (mode, outcome, title) => {
        const at = new Date();
        await LinkedInConnection.updateOne(
            { key: SINGLETON_KEY },
            { $set: { lastConfigTest: { at, mode, outcome } }, $setOnInsert: { key: SINGLETON_KEY } },
            { upsert: true }
        );
        return { mode, outcome, title, checks, testedAt: at };
    };

    if (!cfg.complete) {
        check('oauth', 'OAuth prerequisites', 'fail', 'LinkedIn sign-in cannot start until the settings above are complete.');
        return finish('readiness', 'CONFIG_INCOMPLETE', 'Configuration incomplete');
    }
    check('oauth', 'OAuth prerequisites', 'pass', 'Client ID, client secret and redirect URI are set; Connect LinkedIn can start the sign-in.');

    const doc = await LinkedInConnection.findOne({ key: SINGLETON_KEY });
    const status = describe(doc, cfg);
    if (status.state === 'not_connected') {
        check('connection', 'LinkedIn authorization', 'skip', 'No LinkedIn account is connected, so LinkedIn was not contacted. The client ID and secret are only checked by LinkedIn when you click Connect LinkedIn.');
        return finish('readiness', 'AUTHORIZATION_REQUIRED', 'Credentials saved; LinkedIn authorization required');
    }
    if (status.state === 'reconnect_required') {
        if (status.reconnectCode === 'MISSING_PERMISSION') {
            check('publishing', 'Publishing permission', 'fail', `The stored authorization does not include ${REQUIRED_SCOPE}. Check that the LinkedIn app has the Community Management API product, then reconnect. LinkedIn was not contacted.`);
            return finish('readiness', 'PUBLISHING_PERMISSION_MISSING', 'Publishing permission missing');
        }
        check('connection', 'LinkedIn authorization', 'fail', `The connection must be renewed (${status.reconnectCode}). LinkedIn was not contacted.`);
        return finish('readiness', 'RECONNECT_REQUIRED', 'LinkedIn authorization required');
    }

    // Live: an authorized request with the stored token.
    let token;
    try {
        token = await getUsableAccessToken();
    } catch (err) {
        const code = err instanceof LinkedInError ? err.code : 'UNEXPECTED';
        check('connection', 'LinkedIn authorization', 'fail', err instanceof LinkedInError ? err.message : 'The stored authorization could not be used.');
        return finish('readiness', code === 'RECONNECT_REQUIRED' ? 'RECONNECT_REQUIRED' : 'API_REQUEST_FAILED', 'LinkedIn authorization required');
    }
    check('connection', 'LinkedIn authorization', 'pass', 'A stored authorization is available.');

    if (!token.scopes.includes(REQUIRED_SCOPE)) {
        check('publishing', 'Publishing permission', 'fail', `LinkedIn did not grant ${REQUIRED_SCOPE}. Check the app's products, then reconnect.`);
        return finish('live', 'PUBLISHING_PERMISSION_MISSING', 'Publishing permission missing');
    }

    if (!hasRoleCheckScope(token.scopes)) {
        check('organization', 'Company page access', 'warn', 'This authorization does not include r_organization_admin, so the member\'s role on the page cannot be checked. LinkedIn was not asked; the first post is the first real test.');
        check('publishing', 'Publishing permission', 'warn', `LinkedIn granted ${REQUIRED_SCOPE} to this authorization, but it has not been exercised. It is confirmed only by a successful post.`);
        return finish('live', 'ORGANIZATION_NOT_VERIFIED', 'Connected; organization access not verified');
    }

    try {
        const role = await readPostingRole(cfg, token.accessToken);
        await LinkedInConnection.updateOne({ key: SINGLETON_KEY }, { $set: { roleVerification: { ...role, checkedAt: new Date() } } });
        check('apiVersion', 'API version accepted', 'pass', `LinkedIn answered an authorized request made with LinkedIn-Version ${cfg.apiVersion}.`);
        check('organization', 'Company page access', 'pass', `LinkedIn confirms the connected member is ${role.role} on company page ${cfg.organizationId}.`);
        check('publishing', 'Publishing permission', 'pass', `LinkedIn granted ${REQUIRED_SCOPE}, and the member's page role allows posting. Nothing was posted by this test.`);
        return finish('live', 'CONNECTED_AUTHORIZED', 'Connected and authorized');
    } catch (err) {
        if (err instanceof LinkedInError && err.code === 'NO_ORGANIZATION_ROLE') {
            await LinkedInConnection.updateOne({ key: SINGLETON_KEY }, { $set: { roleVerification: { status: 'not_verified', role: '', memberUrn: '', checkedAt: new Date() } } });
            check('organization', 'Company page access', 'fail', err.message);
            return finish('live', 'NO_ORGANIZATION_ROLE', 'Organization access not verified');
        }
        if (err instanceof LinkedInError && err.code === 'TOKEN_REJECTED') {
            await markReconnectRequired('TOKEN_REJECTED');
            check('connection', 'LinkedIn authorization', 'fail', 'LinkedIn rejected the stored authorization; it may have been revoked. Reconnect LinkedIn.');
            return finish('live', 'RECONNECT_REQUIRED', 'LinkedIn authorization required');
        }
        if (err instanceof LinkedInError && err.code === 'ACCESS_DENIED') {
            check('organization', 'Company page access', 'fail', 'LinkedIn refused the page-role check. The app may not have been approved for r_organization_admin; if so, turn off "Verify page role" and reconnect.');
            return finish('live', 'ORGANIZATION_NOT_VERIFIED', 'Organization access not verified');
        }
        // Only this application's message and LinkedIn's HTTP status — never
        // the response body or an internal exception.
        const detail = err instanceof LinkedInError ? err.message : 'An unexpected error occurred.';
        check('organization', 'Company page access', 'fail', `The LinkedIn API request failed: ${detail}`);
        logger.warn('LinkedIn configuration test request failed', { code: err?.code || 'UNEXPECTED', status: err?.status || null });
        return finish('live', 'API_REQUEST_FAILED', 'LinkedIn API request failed');
    }
};

module.exports = {
    REQUIRED_SCOPE,
    POSTING_ROLES,
    organizationUrn,
    getStatus,
    describe,
    startAuthorization,
    handleCallback,
    disconnect,
    getUsableAccessToken,
    markReconnectRequired,
    testConfiguration,
    hashState
};
