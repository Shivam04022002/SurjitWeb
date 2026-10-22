const env = require('../../config/env');
const LinkedInConnection = require('../../models/LinkedInConnection');
const { SINGLETON_KEY } = require('../../models/LinkedInConnection');
const { encrypt, decrypt } = require('../../utils/secretBox');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// The LinkedIn app configuration actually in force, and the API Settings form
// that edits it.
//
// Precedence, per field: a LINKEDIN_* environment variable, when set, wins and
// the CMS shows the field as managed by the server environment (read only);
// otherwise the value saved on the API Settings page; otherwise the default.
// That keeps a production .env authoritative — nothing typed in the browser
// can silently replace it — while letting a server without those variables
// be configured entirely from the CMS.
//
// Environment only, by design: LINKEDIN_REDIRECT_URI (where LinkedIn sends
// authorization codes — never chosen from the browser), PUBLIC_SITE_URL,
// ADMIN_PANEL_URL and SETTINGS_ENCRYPTION_KEY.
//
// The client secret is decrypted only inside getEffectiveConfig() for the
// LinkedIn client to use; describeConfig() reports only whether one exists.

const DEFAULT_API_VERSION = '202610';
const REQUIRED_SCOPE = 'w_organization_social';
const ROLE_SCOPE = 'r_organization_admin';
const CALLBACK_PATH = '/api/v1/linkedin/oauth/callback';
// LinkedIn supports each API version for roughly a year.
const VERSION_WARN_MONTHS = 10;

const CLIENT_ID_RX = /^[A-Za-z0-9]{6,64}$/;
// Printable ASCII without spaces; LinkedIn secrets include . _ = and similar.
const CLIENT_SECRET_RX = /^[\x21-\x7E]{8,256}$/;

const invalid = (field, message) => new AppError(message, HTTP_STATUS.BAD_REQUEST, [{ field, code: 'INVALID', message }]);

// ── Normalising and validating ────────────────────────────────────────────────

// "1234567", " 1234567 " or "urn:li:organization:1234567" → "1234567".
const normalizeOrganizationId = (value) => {
    const raw = String(value ?? '').trim();
    const m = /^(?:urn:li:organization:)?([0-9]{1,20})$/.exec(raw);
    return m ? m[1].replace(/^0+(?=\d)/, '') : null;
};

// YYYYMM, a real month, not in the future (LinkedIn has no such version yet).
const versionProblem = (version, now = new Date()) => {
    const m = /^(20[0-9]{2})(0[1-9]|1[0-2])$/.exec(String(version || ''));
    if (!m) return 'must be YYYYMM, e.g. 202610';
    const months = Number(m[1]) * 12 + Number(m[2]);
    const current = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
    if (months > current) return 'is in the future; LinkedIn has not released it';
    return '';
};

const versionWarning = (version, now = new Date()) => {
    const m = /^(\d{4})(\d{2})$/.exec(String(version || ''));
    if (!m) return '';
    const age = (now.getUTCFullYear() - Number(m[1])) * 12 + (now.getUTCMonth() + 1 - Number(m[2]));
    return age >= VERSION_WARN_MONTHS
        ? `LinkedIn API version ${version} is ${age} months old and may be near its sunset. Check LinkedIn's versioning page and update it.`
        : '';
};

const scopesFrom = (text) => [...new Set(String(text).split(/[\s,]+/).filter(Boolean))];

// The callback address must be this API's own callback route, over HTTPS
// (plain http only for localhost outside production), with no fragment.
const redirectUriProblem = (value) => {
    if (!value) return 'not set on the server (LINKEDIN_REDIRECT_URI)';
    let u;
    try { u = new URL(value); } catch { return 'is not an absolute URL'; }
    const local = env.NODE_ENV !== 'production' && u.protocol === 'http:' && u.hostname === 'localhost';
    if (u.protocol !== 'https:' && !local) return 'must use HTTPS';
    if (u.hash) return 'must not contain a #fragment';
    if (u.search) return 'must not contain query parameters';
    if (u.username || u.password) return 'must not contain credentials';
    if (u.pathname.replace(/\/+$/, '') !== CALLBACK_PATH) return `must end with this API's callback path ${CALLBACK_PATH}`;
    return '';
};

// ── Reading ───────────────────────────────────────────────────────────────────

const loadDocument = () => LinkedInConnection.findOne({ key: SINGLETON_KEY })
    .select('+config.encryptedClientSecret');

// One field: its value and where it came from.
const pick = (envValue, savedValue, fallback = '') => {
    if (envValue) return { value: envValue, source: 'environment' };
    if (savedValue !== undefined && savedValue !== null && savedValue !== '') return { value: savedValue, source: 'database' };
    return { value: fallback, source: fallback ? 'default' : 'none' };
};

// Everything the integration needs, resolved. Holds the decrypted secret —
// for the LinkedIn client only; never returned from an endpoint.
const resolve = (doc) => {
    const saved = doc?.config || {};
    const clientId = pick(env.LINKEDIN_CLIENT_ID, saved.clientId);
    const orgRaw = pick(env.LINKEDIN_ORGANIZATION_ID, saved.organizationId);
    const apiVersion = pick(env.LINKEDIN_API_VERSION, saved.apiVersion, DEFAULT_API_VERSION);

    let clientSecret = { value: '', source: 'none', readable: true };
    if (env.LINKEDIN_CLIENT_SECRET) {
        clientSecret = { value: env.LINKEDIN_CLIENT_SECRET, source: 'environment', readable: true };
    } else if (saved.encryptedClientSecret) {
        const plain = decrypt(saved.encryptedClientSecret);
        clientSecret = plain
            ? { value: plain, source: 'database', readable: true }
            : { value: '', source: 'database', readable: false };
    }

    let scopes;
    if (env.LINKEDIN_SCOPES) {
        scopes = { value: scopesFrom(env.LINKEDIN_SCOPES), source: 'environment' };
    } else {
        const verifyRole = saved.verifyRole !== false;
        scopes = { value: verifyRole ? [REQUIRED_SCOPE, ROLE_SCOPE] : [REQUIRED_SCOPE], source: doc?.config ? 'database' : 'default' };
    }

    const organizationId = normalizeOrganizationId(orgRaw.value) || '';
    return {
        clientId: clientId.value,
        clientSecret: clientSecret.value,
        organizationId,
        apiVersion: apiVersion.value,
        scopes: scopes.value,
        redirectUri: env.LINKEDIN_REDIRECT_URI,
        sources: {
            clientId: clientId.source,
            clientSecret: clientSecret.source,
            organizationId: orgRaw.source,
            apiVersion: apiVersion.source,
            scopes: scopes.source
        },
        secretReadable: clientSecret.readable,
        organizationIdRaw: orgRaw.value
    };
};

// What is missing or wrong, per field. Never includes a value.
const problemsOf = (cfg) => {
    const problems = [];
    const add = (field, problem) => problems.push({ field, problem });
    if (!cfg.clientId) add('clientId', 'not set');
    else if (!CLIENT_ID_RX.test(cfg.clientId)) add('clientId', 'is not a valid LinkedIn client ID');
    if (!cfg.secretReadable) add('clientSecret', 'is stored but can no longer be decrypted (the server encryption key changed); enter it again');
    else if (!cfg.clientSecret) add('clientSecret', 'not set');
    if (!cfg.organizationIdRaw) add('organizationId', 'not set');
    else if (!cfg.organizationId) add('organizationId', 'must be the numeric company page ID');
    const vp = versionProblem(cfg.apiVersion);
    if (vp) add('apiVersion', vp);
    if (!cfg.scopes.includes(REQUIRED_SCOPE)) add('scopes', `must include ${REQUIRED_SCOPE}`);
    const rp = redirectUriProblem(cfg.redirectUri);
    if (rp) add('redirectUri', rp);
    return problems;
};

const getEffectiveConfig = async () => {
    const cfg = resolve(await loadDocument());
    cfg.problems = problemsOf(cfg);
    cfg.complete = cfg.problems.length === 0;
    return cfg;
};

// The configuration as the CMS may see it: values that are not secret, where
// each came from, and for the secret only whether it is configured.
const describeConfig = (cfg, doc) => ({
    clientId: { value: cfg.clientId, source: cfg.sources.clientId },
    clientSecret: { configured: !!cfg.clientSecret, source: cfg.sources.clientSecret, readable: cfg.secretReadable },
    organizationId: { value: cfg.organizationId || cfg.organizationIdRaw, source: cfg.sources.organizationId },
    apiVersion: { value: cfg.apiVersion, source: cfg.sources.apiVersion, warning: versionWarning(cfg.apiVersion) },
    scopes: { value: cfg.scopes, source: cfg.sources.scopes, required: REQUIRED_SCOPE, roleCheck: cfg.scopes.includes(ROLE_SCOPE) || cfg.scopes.includes('rw_organization_admin') },
    redirectUri: { value: cfg.redirectUri || '', source: cfg.redirectUri ? 'environment' : 'none', expectedPath: CALLBACK_PATH },
    complete: cfg.complete,
    problems: cfg.problems,
    updatedAt: doc?.config?.updatedAt || null
});

const getConfigView = async () => {
    const doc = await loadDocument().populate('config.updatedBy', 'name');
    const cfg = resolve(doc);
    cfg.problems = problemsOf(cfg);
    cfg.complete = cfg.problems.length === 0;
    const view = describeConfig(cfg, doc);
    view.updatedBy = doc?.config?.updatedBy?.name ? { name: doc.config.updatedBy.name } : null;
    return view;
};

// ── Saving ────────────────────────────────────────────────────────────────────

// Saves the fields the form sent. A field managed by the environment cannot
// be saved here (refused, not ignored, so the admin is not misled). An absent
// or empty clientSecret keeps the stored one. Returns the new view, plus what
// the change means for an existing connection.
const saveConfig = async (input, adminId) => {
    const set = {};
    const managed = [];

    if (input.clientId !== undefined) {
        if (env.LINKEDIN_CLIENT_ID) managed.push('clientId');
        else {
            const v = String(input.clientId).trim();
            if (!CLIENT_ID_RX.test(v)) throw invalid('clientId', 'Enter the Client ID from the LinkedIn app\'s Auth tab (letters and digits).');
            set['config.clientId'] = v;
        }
    }
    if (input.clientSecret !== undefined && input.clientSecret !== '') {
        if (env.LINKEDIN_CLIENT_SECRET) managed.push('clientSecret');
        else {
            const v = String(input.clientSecret).trim();
            if (!CLIENT_SECRET_RX.test(v)) throw invalid('clientSecret', 'Enter the Primary Client Secret from the LinkedIn app\'s Auth tab.');
            set['config.encryptedClientSecret'] = encrypt(v);
        }
    }
    if (input.organizationId !== undefined) {
        if (env.LINKEDIN_ORGANIZATION_ID) managed.push('organizationId');
        else {
            const v = normalizeOrganizationId(input.organizationId);
            if (!v) throw invalid('organizationId', 'Enter the numeric company page ID (the digits in urn:li:organization:…).');
            set['config.organizationId'] = v;
        }
    }
    if (input.apiVersion !== undefined && input.apiVersion !== '') {
        if (env.LINKEDIN_API_VERSION) managed.push('apiVersion');
        else {
            const v = String(input.apiVersion).trim();
            const problem = versionProblem(v);
            if (problem) throw invalid('apiVersion', `The API version ${problem}.`);
            set['config.apiVersion'] = v;
        }
    }
    if (input.verifyRole !== undefined) {
        if (env.LINKEDIN_SCOPES) managed.push('verifyRole');
        else set['config.verifyRole'] = input.verifyRole === true;
    }
    if (managed.length) {
        throw new AppError('Some of these settings are managed by the server environment and cannot be changed here.', HTTP_STATUS.CONFLICT,
            managed.map((field) => ({ field, code: 'MANAGED_BY_ENVIRONMENT', message: 'Managed by the server environment' })));
    }
    if (!Object.keys(set).length) throw invalid('form', 'Nothing to save.');

    const before = await getEffectiveConfig();
    set['config.updatedAt'] = new Date();
    set['config.updatedBy'] = adminId;
    await LinkedInConnection.updateOne(
        { key: SINGLETON_KEY },
        { $set: set, $setOnInsert: { key: SINGLETON_KEY } },
        { upsert: true }
    );
    const after = await getEffectiveConfig();

    // What the change does to an existing connection, so the CMS can say so.
    const conn = await LinkedInConnection.findOne({ key: SINGLETON_KEY }).select('connectedAt connectedClientId organizationId');
    const impact = [];
    if (conn?.connectedAt) {
        if (conn.connectedClientId && before.clientId !== after.clientId) impact.push('CLIENT_CHANGED');
        if (before.organizationId !== after.organizationId) impact.push('ORGANIZATION_CHANGED');
        if (before.scopes.join(' ') !== after.scopes.join(' ')) impact.push('SCOPES_CHANGED');
    }
    return { config: await getConfigView(), connectionImpact: impact };
};

module.exports = {
    DEFAULT_API_VERSION,
    REQUIRED_SCOPE,
    ROLE_SCOPE,
    CALLBACK_PATH,
    normalizeOrganizationId,
    versionProblem,
    versionWarning,
    redirectUriProblem,
    getEffectiveConfig,
    getConfigView,
    saveConfig
};
