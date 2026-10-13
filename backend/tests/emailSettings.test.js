// Email Settings: persistence, permissions, secret handling, and Microsoft
// Graph delivery — end to end through the real app and a real (in-memory)
// MongoDB. Only Microsoft is replaced: fetch() requests to
// login.microsoftonline.com and graph.microsoft.com are answered by a fake
// that records each call, and everything else goes to the real network stack.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-email-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-email-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.EMAIL_TEST_RATE_LIMIT_MAX = '1000';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const env = require('../src/config/env');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const EmailSetting = require('../src/models/EmailSetting');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const { decrypt } = require('../src/utils/secretBox');
const graph = require('../src/services/email/microsoftGraph');
const { TEST_SUBJECT } = require('../src/services/email/emailConfig.service');

const SECRET = 'Qx8~Abc.def_GhiJkl-MnoPqrStuVwxYz0123456789';
const OTHER_SECRET = 'Zz9~Other.Secret_Value-0123456789abcdefWXYZ';
const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const CLIENT = '11111111-2222-3333-4444-555555555555';

const validSettings = (overrides = {}) => ({
    provider: 'microsoft365',
    authMethod: 'graph',
    senderName: 'Surjit Finance',
    senderEmail: 'Loans@SurjitFinance.com',
    tenantId: TENANT,
    clientId: CLIENT,
    clientSecret: SECRET,
    primaryRecipient: 'Ops@SurjitFinance.com',
    additionalRecipients: ['Credit@SurjitFinance.com', 'branch@surjitfinance.com'],
    notifyNewLoanApplication: false,
    ...overrides
});

// ── Output capture: proves no secret or token reaches a log line ───────────────
const captured = [];
for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level];
    console[level] = (...args) => {
        captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        if (process.env.TEST_VERBOSE) original(...args);
    };
}

// ── Fake Microsoft ─────────────────────────────────────────────────────────────
const realFetch = global.fetch;
let tokenSerial = 0;
// An app-only Graph token is a JWT whose payload lists the consented
// application permissions in `roles`. The signature is never checked here.
const fakeJwt = (roles) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ roles, n: ++tokenSerial })}.signature${tokenSerial}`;
};

const ms = {
    tokenCalls: [],
    sendCalls: [],
    // What the token endpoint answers: 'ok' or an AADSTS code / special case.
    token: 'ok',
    roles: ['Mail.Send'],
    expiresIn: 3599,
    // A queue of statuses for sendMail; empty means 202.
    send: [],
    retryAfter: null,
    reset() {
        this.tokenCalls = []; this.sendCalls = []; this.token = 'ok'; this.roles = ['Mail.Send'];
        this.expiresIn = 3599; this.send = []; this.retryAfter = null;
    }
};
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const fakeMicrosoft = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        const form = Object.fromEntries(new URLSearchParams(init.body));
        ms.tokenCalls.push({ url: u, form, contentType: new Headers(init.headers).get('content-type') });
        if (ms.token === 'network') throw new TypeError('fetch failed');
        if (ms.token === 'timeout') { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; }
        if (ms.token === 500) return json(500, { error: 'server_error' });
        if (typeof ms.token === 'number') {
            // Microsoft's own description echoes request details; it must not reach the page.
            return json(401, { error: 'invalid_client', error_codes: [ms.token], error_description: `AADSTS${ms.token}: problem with client_secret=${form.client_secret}` });
        }
        return json(200, { token_type: 'Bearer', expires_in: ms.expiresIn, access_token: fakeJwt(ms.roles) });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        const auth = new Headers(init.headers).get('authorization');
        ms.sendCalls.push({ url: u, auth, body: JSON.parse(init.body) });
        const status = ms.send.length ? ms.send.shift() : 202;
        if (status === 202) return new Response(null, { status: 202 });
        const codes = { 401: 'InvalidAuthenticationToken', 403: 'ErrorAccessDenied', 404: 'ErrorInvalidUser', 429: 'ApplicationThrottled', 503: 'ServiceUnavailable', 400: 'ErrorInvalidRecipients' };
        return json(status, { error: { code: codes[status], message: `Graph says no for ${auth}` } }, ms.retryAfter ? { 'Retry-After': String(ms.retryAfter) } : {});
    }
    return realFetch(url, init);
};

// ── HTTP helpers ───────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};
const responses = [];

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await realFetch(`${baseUrl}/api/v1/email-settings${url}`, { method, headers, body: payload });
    const text = await res.text();
    responses.push(text);
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: parsed, text };
};

const save = (overrides = {}, token = tokens.super) => call('PUT', '', { token, body: validSettings(overrides) });
const stored = () => EmailSetting.findOne({ key: 'default' }).select('+encryptedClientSecret').lean();
const errorFields = (res) => (res.body?.errors || []).map((e) => e.field);

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();

    // A custom role that may read the API Settings pages but not change them.
    await Role.create({ key: 'integrations_viewer', name: 'Integrations Viewer', permissions: ['integrations.view'] });

    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'integrations_viewer' };
    for (const [k, role] of Object.entries(roles)) {
        const a = await Admin.create({ name: `Test ${k}`, email: `${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }

    global.fetch = fakeMicrosoft;
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    global.fetch = realFetch;
    server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
});

beforeEach(() => {
    ms.reset();
    graph.clearTokenCache();
});

describe('authorization is enforced by the server', () => {
    test('no session: every endpoint refuses with 401', async () => {
        for (const [method, url] of [['GET', ''], ['PUT', ''], ['POST', '/test-connection'], ['POST', '/test-email']]) {
            assert.equal((await call(method, url, { body: method === 'GET' ? undefined : {} })).status, 401, `${method} ${url}`);
        }
    });

    test('Editor and Content Manager (no API Settings permission) are refused everything', async () => {
        for (const who of ['editor', 'content']) {
            assert.equal((await call('GET', '', { token: tokens[who] })).status, 403, `${who} GET`);
            assert.equal((await save({}, tokens[who])).status, 403, `${who} PUT`);
            assert.equal((await call('POST', '/test-connection', { token: tokens[who] })).status, 403, `${who} test`);
            assert.equal((await call('POST', '/test-email', { token: tokens[who], body: { recipient: 'a@b.com' } })).status, 403, `${who} send`);
        }
        assert.equal(await EmailSetting.countDocuments(), 0, 'nothing was written');
        assert.equal(ms.tokenCalls.length + ms.sendCalls.length, 0, 'Microsoft was never called');
    });

    test('a view-only role may read but not save, test or send', async () => {
        assert.equal((await call('GET', '', { token: tokens.viewer })).status, 200);
        assert.equal((await save({}, tokens.viewer)).status, 403);
        assert.equal((await call('POST', '/test-connection', { token: tokens.viewer })).status, 403);
        assert.equal((await call('POST', '/test-email', { token: tokens.viewer, body: { recipient: 'a@b.com' } })).status, 403);
        assert.equal(ms.tokenCalls.length + ms.sendCalls.length, 0);
    });
});

describe('before anything is saved', () => {
    test('GET reports nothing saved and not configured', async () => {
        const res = await call('GET', '', { token: tokens.super });
        assert.equal(res.status, 200);
        const c = res.body.data.config;
        assert.equal(c.saved, false);
        assert.equal(c.configured, false);
        assert.equal(c.settings, null);
        assert.deepEqual(c.clientSecret, { configured: false, readable: false, hint: '' });
        assert.deepEqual(c.supported, [{ provider: 'microsoft365', authMethod: 'graph' }]);
    });

    test('tests report NOT_CONFIGURED without calling Microsoft', async () => {
        const conn = await call('POST', '/test-connection', { token: tokens.super });
        assert.equal(conn.status, 200);
        assert.equal(conn.body.data.result.ok, false);
        assert.equal(conn.body.data.result.code, 'NOT_CONFIGURED');
        const send = await call('POST', '/test-email', { token: tokens.super, body: { recipient: 'test@x.com' } });
        assert.equal(send.body.data.result.code, 'NOT_CONFIGURED');
        assert.equal(ms.tokenCalls.length + ms.sendCalls.length, 0);
    });

    test('the first save needs a client secret', async () => {
        const res = await save({ clientSecret: '' });
        assert.equal(res.status, 400);
        assert.deepEqual(errorFields(res), ['clientSecret']);
        assert.equal(await EmailSetting.countDocuments(), 0);
    });
});

describe('validation', () => {
    const rejects = async (overrides, field, messagePart) => {
        const res = await save(overrides);
        assert.equal(res.status, 400, JSON.stringify(overrides));
        assert.ok(errorFields(res).includes(field), `${field} in ${errorFields(res)}`);
        if (messagePart) assert.ok(res.body.errors.some((e) => e.message.includes(messagePart)), res.text);
        return res;
    };

    test('unsupported providers and methods are refused with a clear message', async () => {
        await rejects({ provider: 'outlook', authMethod: 'graph' }, 'authMethod', 'Outlook Personal is not available yet');
        await rejects({ provider: 'exchange', authMethod: 'smtp_basic' }, 'authMethod', 'Organization-managed Exchange is not available yet');
        await rejects({ authMethod: 'smtp_oauth' }, 'authMethod', 'SMTP with Microsoft OAuth 2.0 is not available yet');
        await rejects({ authMethod: 'smtp_basic' }, 'authMethod', 'not available yet');
        await rejects({ provider: 'gmail' }, 'provider');
    });

    test('addresses, identifiers and the secret are checked', async () => {
        await rejects({ senderEmail: 'not-an-email' }, 'senderEmail', 'valid email');
        await rejects({ senderEmail: '' }, 'senderEmail', 'required');
        await rejects({ primaryRecipient: 'a b@c.com' }, 'primaryRecipient');
        await rejects({ tenantId: 'not a tenant' }, 'tenantId');
        // App-only tokens need a specific tenant, not a shared authority.
        await rejects({ tenantId: 'common' }, 'tenantId');
        await rejects({ tenantId: 'consumers' }, 'tenantId');
        await rejects({ clientId: '1234' }, 'clientId', '00000000-0000');
        await rejects({ senderName: 'Surjit\r\nBcc: victim@x.com' }, 'senderName', 'line breaks');
        await rejects({ senderName: 'x'.repeat(101) }, 'senderName');
        await rejects({ notifyNewLoanApplication: 'yes' }, 'notifyNewLoanApplication');
    });

    test('a malformed secret is refused without being echoed', async () => {
        const bad = 'has a space in it 1234';
        const res = await rejects({ clientSecret: bad }, 'clientSecret');
        assert.ok(!res.text.includes(bad));
    });

    test('recipients: valid, distinct (ignoring case) and at most ten', async () => {
        await rejects({ additionalRecipients: ['ok@x.com', 'nope'] }, 'additionalRecipients', 'valid email');
        await rejects({ additionalRecipients: ['a@x.com', 'A@X.com'] }, 'additionalRecipients', 'must not repeat');
        await rejects({ additionalRecipients: ['OPS@surjitfinance.com'] }, 'additionalRecipients', 'must not repeat');
        await rejects({ additionalRecipients: Array.from({ length: 11 }, (_, i) => `r${i}@x.com`) }, 'additionalRecipients', 'at most 10');
        await rejects({ additionalRecipients: 'a@x.com' }, 'additionalRecipients');
    });

    test('nothing was stored by any refused request', async () => {
        assert.equal(await EmailSetting.countDocuments(), 0);
    });
});

describe('persistence and secret handling', () => {
    test('a valid save is stored, normalised and encrypted', async () => {
        const res = await save();
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.equal(c.saved, true);
        assert.equal(c.configured, true);
        assert.deepEqual(c.missing, []);
        assert.equal(c.settings.senderEmail, 'loans@surjitfinance.com');
        assert.equal(c.settings.primaryRecipient, 'ops@surjitfinance.com');
        assert.deepEqual(c.settings.additionalRecipients, ['credit@surjitfinance.com', 'branch@surjitfinance.com']);
        assert.equal(c.settings.notifyNewLoanApplication, false);
        assert.deepEqual(c.clientSecret, { configured: true, readable: true, hint: SECRET.slice(-4) });

        const doc = await stored();
        assert.ok(doc.encryptedClientSecret.data, 'ciphertext stored');
        assert.ok(!JSON.stringify(doc).includes(SECRET), 'the secret is not stored in plain text');
        assert.equal(decrypt(doc.encryptedClientSecret), SECRET);
    });

    test('a reload returns the same settings and never the secret', async () => {
        const res = await call('GET', '', { token: tokens.viewer });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.config.settings.tenantId, TENANT);
        assert.equal(res.body.data.config.settings.clientId, CLIENT);
        assert.ok(!res.text.includes(SECRET));
        assert.ok(!/encryptedClientSecret|"iv"|"tag"/.test(res.text), 'no ciphertext in the response');
    });

    test('a blank or missing secret keeps the stored one', async () => {
        const before = (await stored()).encryptedClientSecret;
        let res = await save({ clientSecret: '', additionalRecipients: [] });
        assert.equal(res.status, 200, res.text);
        assert.deepEqual((await stored()).encryptedClientSecret, before, 'blank: ciphertext untouched');

        const body = validSettings({ additionalRecipients: ['credit@surjitfinance.com'] });
        delete body.clientSecret;
        res = await call('PUT', '', { token: tokens.super, body });
        assert.equal(res.status, 200, res.text);
        assert.deepEqual((await stored()).encryptedClientSecret, before, 'absent: ciphertext untouched');
        assert.equal(res.body.data.config.clientSecret.hint, SECRET.slice(-4));
        assert.deepEqual(res.body.data.config.settings.additionalRecipients, ['credit@surjitfinance.com']);
    });

    test('a new secret replaces the old one', async () => {
        const res = await save({ clientSecret: OTHER_SECRET });
        assert.equal(res.body.data.config.clientSecret.hint, OTHER_SECRET.slice(-4));
        assert.equal(decrypt((await stored()).encryptedClientSecret), OTHER_SECRET);
        await save({ clientSecret: SECRET });
    });

    test('a secret that no longer decrypts is reported and must be entered again', async () => {
        const original = env.SETTINGS_ENCRYPTION_KEY;
        env.SETTINGS_ENCRYPTION_KEY = 'a-different-encryption-key-than-before';
        try {
            const res = await call('GET', '', { token: tokens.super });
            assert.equal(res.body.data.config.configured, false);
            assert.deepEqual(res.body.data.config.clientSecret, { configured: true, readable: false, hint: SECRET.slice(-4) });
            const blank = await save({ clientSecret: '' });
            assert.equal(blank.status, 400);
            assert.ok(blank.body.errors[0].message.includes('can no longer be read'));
            const conn = await call('POST', '/test-connection', { token: tokens.super });
            assert.equal(conn.body.data.result.code, 'NOT_CONFIGURED');
            assert.equal(ms.tokenCalls.length, 0);
        } finally {
            env.SETTINGS_ENCRYPTION_KEY = original;
        }
        assert.equal((await call('GET', '', { token: tokens.super })).body.data.config.configured, true);
    });
});

describe('Test Connection', () => {
    test('signs in with client credentials and checks Mail.Send', async () => {
        const res = await call('POST', '/test-connection', { token: tokens.super });
        assert.equal(res.status, 200);
        const r = res.body.data.result;
        assert.equal(r.ok, true, r.message);
        assert.equal(r.code, 'CONNECTED');

        assert.equal(ms.tokenCalls.length, 1);
        const t = ms.tokenCalls[0];
        assert.equal(t.url, `${graph.LOGIN_BASE}/${TENANT}/oauth2/v2.0/token`);
        assert.equal(t.contentType, 'application/x-www-form-urlencoded');
        assert.deepEqual(t.form, { grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET, scope: 'https://graph.microsoft.com/.default' });
        assert.equal(ms.sendCalls.length, 0, 'a connection test sends nothing');

        assert.equal(res.body.data.config.lastTest.kind, 'connection');
        assert.equal(res.body.data.config.lastTest.ok, true);
        assert.ok(!res.text.includes(SECRET));
    });

    test('always uses a fresh token', async () => {
        await call('POST', '/test-connection', { token: tokens.super });
        await call('POST', '/test-connection', { token: tokens.super });
        assert.equal(ms.tokenCalls.length, 2);
    });

    test('a token without Mail.Send is a failure that says what to grant', async () => {
        ms.roles = ['User.Read.All'];
        const r = (await call('POST', '/test-connection', { token: tokens.super })).body.data.result;
        assert.equal(r.ok, false);
        assert.equal(r.code, 'MISSING_PERMISSION');
        assert.match(r.message, /Mail\.Send/);
    });

    const tokenFailure = async (setting, code) => {
        ms.token = setting;
        const res = await call('POST', '/test-connection', { token: tokens.super });
        const r = res.body.data.result;
        assert.equal(r.ok, false);
        assert.equal(r.code, code, r.message);
        assert.ok(!res.text.includes(SECRET), 'Microsoft\'s echo of the secret is not passed on');
        assert.equal(res.body.data.config.lastTest.code, code);
        return r;
    };

    test('Microsoft sign-in errors are explained', async () => {
        assert.match((await tokenFailure(7000215, 'INVALID_CLIENT_SECRET')).message, /AADSTS7000215/);
        await tokenFailure(7000222, 'CLIENT_SECRET_EXPIRED');
        await tokenFailure(700016, 'APP_NOT_FOUND');
        await tokenFailure(90002, 'TENANT_NOT_FOUND');
        await tokenFailure(12345, 'AUTH_FAILED');
        await tokenFailure(500, 'MICROSOFT_UNAVAILABLE');
        await tokenFailure('network', 'NETWORK');
        await tokenFailure('timeout', 'TIMEOUT');
    });
});

describe('Send Test Email', () => {
    const send = (recipient = 'Tester@Example.com', extra = {}) => call('POST', '/test-email', { token: tokens.super, body: { recipient, ...extra } });

    test('sends one fixed message through Graph as the sender mailbox', async () => {
        const res = await send('Tester@Example.com', { subject: 'Win a prize', html: '<a href="x">click</a>', to: ['victim@x.com'] });
        assert.equal(res.status, 200);
        const r = res.body.data.result;
        assert.equal(r.ok, true, r.message);
        assert.equal(r.code, 'SENT');
        assert.match(r.message, /tester@example\.com/);

        assert.equal(ms.sendCalls.length, 1);
        const c = ms.sendCalls[0];
        assert.equal(c.url, `${graph.GRAPH_BASE}/users/loans%40surjitfinance.com/sendMail`);
        assert.match(c.auth, /^Bearer [\w-]+\.[\w-]+\.signature\d+$/);
        assert.equal(c.body.saveToSentItems, false);
        assert.equal(c.body.message.subject, TEST_SUBJECT, 'the request cannot set the subject');
        assert.equal(c.body.message.body.contentType, 'Text');
        assert.ok(!c.body.message.body.content.includes('click'), 'the request cannot set the body');
        assert.deepEqual(c.body.message.toRecipients, [{ emailAddress: { address: 'tester@example.com' } }], 'only the one validated recipient');
        assert.deepEqual(c.body.message.from, { emailAddress: { address: 'loans@surjitfinance.com', name: 'Surjit Finance' } });

        assert.equal(res.body.data.config.lastTest.kind, 'email');
        assert.equal(res.body.data.config.lastTest.ok, true);
    });

    test('the recipient is required and validated', async () => {
        for (const recipient of [undefined, '', 'nope', 'a@b.com, c@d.com', ['a@b.com']]) {
            const res = await call('POST', '/test-email', { token: tokens.super, body: recipient === undefined ? {} : { recipient } });
            assert.equal(res.status, 400, JSON.stringify(recipient));
            assert.deepEqual(errorFields(res), ['recipient']);
        }
        assert.equal(ms.sendCalls.length, 0);
    });

    test('tokens are cached until close to expiry', async () => {
        await send(); await send();
        assert.equal(ms.tokenCalls.length, 1, 'a valid token is reused');
        assert.equal(ms.sendCalls.length, 2);
        assert.notEqual(ms.sendCalls[0].auth, undefined);
        assert.equal(ms.sendCalls[0].auth, ms.sendCalls[1].auth);

        graph.clearTokenCache(); ms.reset();
        // Inside the expiry margin: never reused.
        ms.expiresIn = Math.floor(graph.EXPIRY_MARGIN_MS / 1000) - 1;
        await send(); await send();
        assert.equal(ms.tokenCalls.length, 2, 'a token about to expire is replaced');
        assert.notEqual(ms.sendCalls[0].auth, ms.sendCalls[1].auth);
    });

    test('a changed secret is not served the old token', async () => {
        await send();
        await save({ clientSecret: OTHER_SECRET });
        await send();
        assert.equal(ms.tokenCalls.length, 2);
        assert.equal(ms.tokenCalls[1].form.client_secret, OTHER_SECRET);
        await save({ clientSecret: SECRET });
    });

    test('a token Graph rejects is replaced once, then reported', async () => {
        ms.send = [401];
        let r = (await send()).body.data.result;
        assert.equal(r.ok, true, 'retried with a fresh token');
        assert.equal(ms.tokenCalls.length, 2);
        assert.equal(ms.sendCalls.length, 2);

        ms.reset(); graph.clearTokenCache();
        ms.send = [401, 401];
        r = (await send()).body.data.result;
        assert.equal(r.ok, false);
        assert.equal(r.code, 'TOKEN_REJECTED');
        assert.equal(ms.sendCalls.length, 2, 'only one retry');
    });

    const graphFailure = async (status, code) => {
        ms.send = [status];
        const res = await send();
        const r = res.body.data.result;
        assert.equal(r.ok, false);
        assert.equal(r.code, code, r.message);
        assert.ok(!res.text.includes('Bearer'), 'the access token is not echoed');
        assert.equal(res.body.data.config.lastTest.ok, false);
        return r;
    };

    test('Graph delivery failures are explained', async () => {
        assert.match((await graphFailure(403, 'ACCESS_DENIED')).message, /Mail\.Send/);
        assert.match((await graphFailure(404, 'MAILBOX_NOT_FOUND')).message, /ErrorInvalidUser/);
        await graphFailure(400, 'REJECTED');
        await graphFailure(503, 'MICROSOFT_UNAVAILABLE');
        ms.retryAfter = 30;
        const throttled = await graphFailure(429, 'THROTTLED');
        assert.equal(throttled.retryAfter, 30);
        assert.match(throttled.message, /30 seconds/);
    });

    test('a sign-in failure stops the send', async () => {
        ms.token = 7000215;
        const r = (await send()).body.data.result;
        assert.equal(r.code, 'INVALID_CLIENT_SECRET');
        assert.equal(ms.sendCalls.length, 0);
    });
});

describe('the last test follows the configuration', () => {
    test('changing only recipients keeps the last test; changing the connection clears it', async () => {
        await call('POST', '/test-connection', { token: tokens.super });
        let c = (await save({ clientSecret: '', additionalRecipients: [] })).body.data.config;
        assert.equal(c.lastTest?.kind, 'connection', 'kept');
        c = (await save({ clientSecret: '', tenantId: 'surjitfinance.onmicrosoft.com' })).body.data.config;
        assert.equal(c.lastTest, null, 'cleared');
    });
});

test('no secret, ciphertext or access token appears in any response or log line', async () => {
    const all = [...responses, ...captured].join('\n');
    for (const s of [SECRET, OTHER_SECRET]) assert.ok(!all.includes(s), 'secret leaked');
    assert.ok(!/signature\d+/.test(all), 'access token leaked');
});
