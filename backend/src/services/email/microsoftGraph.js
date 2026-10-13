const crypto = require('crypto');

// Microsoft Graph email delivery for an organizational mailbox, using the
// OAuth 2.0 client-credentials flow: the CMS signs in as its own Entra app
// registration (tenant ID, client ID, client secret) and sends as the sender
// mailbox through POST /users/{sender}/sendMail. That needs the Graph
// application permission Mail.Send, granted with administrator consent — and
// nothing broader.
//
// Plain fetch rather than an SDK: two calls are needed. The client secret is
// only ever placed in the token request's form body; the access token only in
// an Authorization header. Neither appears in an error message, a log line or
// anything returned from here.

const LOGIN_BASE = 'https://login.microsoftonline.com';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'https://graph.microsoft.com/.default';
const REQUIRED_ROLE = 'Mail.Send';
const TIMEOUT_MS = 15000;
// A token is replaced this long before Microsoft says it expires, so one is
// never sent in its last moments.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

class MicrosoftError extends Error {
    constructor(code, message, { status = null, retryAfter = null } = {}) {
        super(message);
        this.name = 'MicrosoftError';
        this.code = code;
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

// ── Token cache ───────────────────────────────────────────────────────────────
// In memory only, keyed by a hash of the credentials so that a changed secret
// or app is never served a token issued to the previous one. The secret itself
// is not a key here.
const tokenCache = new Map();

const cacheKey = ({ tenantId, clientId, clientSecret }) => crypto
    .createHash('sha256')
    .update(`${tenantId}\n${clientId}\n${clientSecret}`)
    .digest('hex');

const clearTokenCache = () => tokenCache.clear();

const timeoutSignal = () => AbortSignal.timeout(TIMEOUT_MS);

const networkError = (err, what) => (err?.name === 'TimeoutError' || err?.name === 'AbortError'
    ? new MicrosoftError('TIMEOUT', `Microsoft did not respond to the ${what} within ${TIMEOUT_MS / 1000} seconds. Try again.`)
    : new MicrosoftError('NETWORK', `Could not reach Microsoft for the ${what}. Check the server's internet connection and try again.`));

const retryAfterSeconds = (res) => {
    const v = res.headers.get('retry-after');
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
};

const readJson = async (res) => {
    try { return await res.json(); } catch { return null; }
};

// Entra reports token failures as AADSTS codes. The common ones an admin can
// fix get their own message; anything else is named by its code.
const AADSTS_MESSAGES = {
    7000215: ['INVALID_CLIENT_SECRET', 'Microsoft rejected the client secret. Copy the secret Value (not the Secret ID) from the app registration and save it again.'],
    7000222: ['CLIENT_SECRET_EXPIRED', 'The client secret has expired. Create a new secret in the app registration and save it here.'],
    700016: ['APP_NOT_FOUND', 'No app with this application (client) ID exists in the tenant. Check the client ID and tenant ID.'],
    90002: ['TENANT_NOT_FOUND', 'Microsoft could not find this tenant. Check the directory (tenant) ID.'],
    900023: ['TENANT_NOT_FOUND', 'The directory (tenant) ID is not valid. Check it on the app registration\'s overview.'],
    7000112: ['APP_DISABLED', 'The app registration is disabled in the tenant.'],
    700024: ['INVALID_CLIENT', 'Microsoft rejected the client credentials.'],
    50020: ['INVALID_CLIENT', 'The app is not allowed to sign in to this tenant.']
};

const tokenError = (status, body) => {
    const codes = Array.isArray(body?.error_codes) ? body.error_codes : [];
    const known = codes.map((c) => AADSTS_MESSAGES[c]).find(Boolean);
    if (known) return new MicrosoftError(known[0], `${known[1]} (AADSTS${codes[0]})`, { status });
    if (status === 429) return new MicrosoftError('THROTTLED', 'Microsoft is limiting sign-in requests. Try again in a few minutes.', { status });
    if (status >= 500) return new MicrosoftError('MICROSOFT_UNAVAILABLE', 'Microsoft sign-in is temporarily unavailable. Try again shortly.', { status });
    const code = codes.length ? ` (AADSTS${codes[0]})` : '';
    return new MicrosoftError('AUTH_FAILED', `Microsoft refused to issue a token for this app${code}. Check the tenant ID, client ID and client secret.`, { status });
};

// The roles claim of an app-only Graph token lists the application
// permissions consented for it. The token is only read here, not verified:
// it came straight from Microsoft over TLS, and Graph verifies it on use.
const rolesOf = (accessToken) => {
    try {
        const payload = JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString('utf8'));
        return Array.isArray(payload.roles) ? payload.roles : [];
    } catch {
        return [];
    }
};

// A token for the app, from the cache while it is comfortably valid.
// `fresh` skips the cache — what Test Connection uses, so it proves the
// credentials as they are now rather than as they were an hour ago.
const getAccessToken = async (credentials, { fresh = false } = {}) => {
    const key = cacheKey(credentials);
    const hit = tokenCache.get(key);
    if (!fresh && hit && hit.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return hit;

    let res;
    try {
        res = await fetch(`${LOGIN_BASE}/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: credentials.clientId,
                client_secret: credentials.clientSecret,
                scope: SCOPE
            }).toString(),
            signal: timeoutSignal()
        });
    } catch (err) {
        throw networkError(err, 'sign-in request');
    }

    const body = await readJson(res);
    if (!res.ok) throw tokenError(res.status, body);
    if (!body?.access_token) throw new MicrosoftError('AUTH_FAILED', 'Microsoft returned no access token.', { status: res.status });

    const expiresIn = Number(body.expires_in) > 0 ? Number(body.expires_in) : 3599;
    const entry = {
        accessToken: body.access_token,
        expiresAt: Date.now() + expiresIn * 1000,
        roles: rolesOf(body.access_token)
    };
    tokenCache.set(key, entry);
    return entry;
};

const hasMailSend = (token) => token.roles.includes(REQUIRED_ROLE);

// Graph errors carry { error: { code, message } }. Messages are Microsoft's
// own words and may name the mailbox, never a credential — but they are still
// replaced here with what the admin should do, keeping only Graph's code.
const graphError = (res, body) => {
    const status = res.status;
    const graphCode = body?.error?.code || '';
    const suffix = graphCode ? ` (${graphCode})` : '';
    if (status === 429) {
        const wait = retryAfterSeconds(res);
        return new MicrosoftError('THROTTLED', `Microsoft Graph is throttling requests${wait ? `; retry after ${wait} seconds` : ''}.${suffix}`, { status, retryAfter: wait });
    }
    if (status === 401) return new MicrosoftError('TOKEN_REJECTED', `Microsoft Graph rejected the access token.${suffix}`, { status });
    if (status === 403) {
        return new MicrosoftError('ACCESS_DENIED', `The app is not allowed to send as the sender mailbox. Grant the Mail.Send application permission with admin consent, and check that no application access policy excludes this mailbox.${suffix}`, { status });
    }
    if (status === 404 || graphCode === 'ErrorInvalidUser' || graphCode === 'MailboxNotEnabledForRESTAPI') {
        return new MicrosoftError('MAILBOX_NOT_FOUND', `Microsoft 365 has no usable mailbox for the sender email. It must be a licensed Exchange Online mailbox in this tenant.${suffix}`, { status });
    }
    if (status === 400) return new MicrosoftError('REJECTED', `Microsoft Graph rejected the message.${suffix}`, { status });
    if (status >= 500) return new MicrosoftError('MICROSOFT_UNAVAILABLE', `Microsoft Graph is temporarily unavailable. Try again shortly.${suffix}`, { status });
    return new MicrosoftError('DELIVERY_FAILED', `Microsoft Graph could not send the message (HTTP ${status}).${suffix}`, { status });
};

// A send request that fails without an answer from Graph — a timeout or a
// dropped connection — may still have been accepted. That is reported as its
// own code, so a caller that retries can tell it apart from a refusal and not
// risk sending the same message twice.
const postSend = async (accessToken, sender, { contentType, body }) => {
    try {
        return await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
            body,
            signal: timeoutSignal()
        });
    } catch {
        throw new MicrosoftError('SEND_UNCONFIRMED', 'The send request to Microsoft did not complete, so the message may or may not have been sent. Check the recipient\'s inbox before trying again.');
    }
};

// Graph answers 202 Accepted: the message has been accepted for delivery,
// which is as far as Graph can tell. A token Graph refuses (revoked, or consent
// changed since it was cached) is replaced once with a fresh one before the
// failure is reported — Graph refused that request, so nothing was sent.
const deliver = async (credentials, sender, request) => {
    let token = await getAccessToken(credentials);
    let res = await postSend(token.accessToken, sender, request);
    if (res.status === 401) {
        tokenCache.delete(cacheKey(credentials));
        token = await getAccessToken(credentials, { fresh: true });
        res = await postSend(token.accessToken, sender, request);
    }
    if (res.status !== 202 && !res.ok) throw graphError(res, await readJson(res));
    return { accepted: true, status: res.status };
};

// Sends one plain-text message as `sender`.
const sendMail = (credentials, { sender, senderName, to, subject, text }) => deliver(credentials, sender, {
    contentType: 'application/json',
    body: JSON.stringify({
        message: {
            subject,
            body: { contentType: 'Text', content: text },
            from: { emailAddress: { address: sender, ...(senderName ? { name: senderName } : {}) } },
            toRecipients: to.map((address) => ({ emailAddress: { address } }))
        },
        saveToSentItems: false
    })
});

// Sends a complete MIME message as `sender` — how a message with both an HTML
// and a plain-text part is sent, since Graph's JSON form carries one body only.
// Graph takes the MIME base64-encoded, as text/plain, through the same
// endpoint and permission (Mail.Send). The message is kept in the sender's
// Sent Items.
const sendMime = (credentials, { sender, mime }) => deliver(credentials, sender, {
    contentType: 'text/plain',
    body: Buffer.from(mime, 'utf8').toString('base64')
});

module.exports = {
    getAccessToken,
    hasMailSend,
    sendMail,
    sendMime,
    clearTokenCache,
    MicrosoftError,
    REQUIRED_ROLE,
    LOGIN_BASE,
    GRAPH_BASE,
    EXPIRY_MARGIN_MS
};
