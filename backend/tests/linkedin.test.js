// Share to LinkedIn: the OAuth connection on the API Settings page and
// publishing a blog to the company page — end-to-end over HTTP against an
// in-memory MongoDB, with real JWTs for each role and LinkedIn replaced by a
// programmable fake behind global.fetch. Nothing here reaches LinkedIn.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-linkedin-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-linkedin-suite';
process.env.SETTINGS_ENCRYPTION_KEY = 'test-settings-key-for-linkedin-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.LINKEDIN_CLIENT_ID = 'testclientid01';
process.env.LINKEDIN_CLIENT_SECRET = 'TEST-CLIENT-SECRET-must-never-leak';
process.env.LINKEDIN_REDIRECT_URI = 'https://cms-api.surjitfinance.com/api/v1/linkedin/oauth/callback';
process.env.LINKEDIN_ORGANIZATION_ID = '1234567';
process.env.LINKEDIN_API_VERSION = '202610';
process.env.LINKEDIN_SCOPES = 'w_organization_social r_organization_admin';
process.env.LINKEDIN_IMAGE_POLL_MS = '5';
process.env.LINKEDIN_IMAGE_POLL_ATTEMPTS = '4';
process.env.LINKEDIN_PUBLISH_RATE_LIMIT_MAX = '1000';
process.env.PUBLIC_SITE_URL = 'https://surjitfinance.com';
process.env.ADMIN_PANEL_URL = 'https://cms.surjitfinance.com';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Blog = require('../src/models/Blog');
const LinkedInConnection = require('../src/models/LinkedInConnection');
const LinkedInPublication = require('../src/models/LinkedInPublication');
const { generateAccessToken } = require('../src/utils/token');
const { decrypt } = require('../src/utils/secretBox');
const { redactUrl } = require('../src/utils/redactUrl');
const logger = require('../src/utils/logger');
const publishing = require('../src/services/linkedin/linkedinPublish.service');
const connectionService = require('../src/services/linkedin/linkedinConnection.service');

// ── Captured logs ─────────────────────────────────────────────────────────────
// Every log line, so the suite can prove no credential is ever written.
const logLines = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
    const original = logger[level]?.bind(logger);
    logger[level] = (...args) => {
        logLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        if (level === 'error' && original && process.env.SHOW_LOGS) original(...args);
    };
}

// ── Fake LinkedIn ─────────────────────────────────────────────────────────────

const ACCESS = 'AQX-fake-access-token-0123456789';
const REFRESH = 'AQR-fake-refresh-token-9876543210';
const AUTH_CODE = 'AQT-fake-authorization-code-abcdef';

let fake;
const resetFake = () => {
    fake = {
        calls: [],
        token: { status: 200, body: { access_token: ACCESS, expires_in: 5184000, scope: 'w_organization_social,r_organization_admin' } },
        refresh: { status: 200, body: { access_token: `${ACCESS}-refreshed`, expires_in: 5184000, refresh_token: REFRESH, refresh_token_expires_in: 20000000 } },
        acls: { status: 200, body: { elements: [{ role: 'ADMINISTRATOR', organization: 'urn:li:organization:1234567', roleAssignee: 'urn:li:person:abc', state: 'APPROVED' }] } },
        init: { status: 200, body: { value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/C4E/uploaded-image/0?ut=x', uploadUrlExpiresAt: 1, image: 'urn:li:image:C4E10AQF' } } },
        upload: { status: 201 },
        imageStatuses: ['PROCESSING', 'AVAILABLE'],
        post: { status: 201, id: 'urn:li:share:6844785523593134080' }
    };
};
resetFake();

const json = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', ...headers }
});

const realFetch = global.fetch;
global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('linkedin.com')) return realFetch(url, init);
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body = init.body;
    if (typeof body === 'string' && headers['content-type'] === 'application/json') body = JSON.parse(body);
    if (typeof body === 'string' && headers['content-type'] === 'application/x-www-form-urlencoded') body = Object.fromEntries(new URLSearchParams(body));
    const call = { url: u, method: init.method || 'GET', headers, body };
    fake.calls.push(call);

    if (u === 'https://www.linkedin.com/oauth/v2/accessToken') {
        const r = body.grant_type === 'refresh_token' ? fake.refresh : fake.token;
        return json(r.status, r.body);
    }
    if (u.startsWith('https://api.linkedin.com/rest/organizationAcls')) return json(fake.acls.status, fake.acls.body);
    if (u === 'https://api.linkedin.com/rest/images?action=initializeUpload') return json(fake.init.status, fake.init.body);
    if (u.startsWith('https://www.linkedin.com/dms-uploads/')) return new Response(null, { status: fake.upload.status });
    if (u.startsWith('https://api.linkedin.com/rest/images/')) {
        const status = fake.imageStatuses.length > 1 ? fake.imageStatuses.shift() : fake.imageStatuses[0];
        return json(200, { id: 'urn:li:image:C4E10AQF', status });
    }
    if (u === 'https://api.linkedin.com/rest/posts') {
        const p = fake.post;
        if (p.timeout) { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; }
        if (p.status === 201) return new Response(null, { status: 201, headers: p.id ? { 'x-restli-id': p.id } : {} });
        return json(p.status, { status: p.status, code: p.code || 'ERR', message: 'secret details from LinkedIn' });
    }
    throw new Error(`Unexpected LinkedIn call ${u}`);
};
const callsTo = (fragment, method) => fake.calls.filter((c) => c.url.includes(fragment) && (!method || c.method === method));

// ── App, roles, fixtures ──────────────────────────────────────────────────────

let mongo;
let server;
let baseUrl;
const tokens = {};
const admins = {};

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await realFetch(`${baseUrl}/api${url}`, { method, headers, body: payload, redirect: 'manual' });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: parsed, text, location: res.headers.get('location') };
};

const L = '/v1/linkedin';
const fixtureDir = path.join(__dirname, '..', 'src', 'uploads', `linkedin-test-${process.pid}`);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);

let blogSeq = 0;
const makeBlog = async (overrides = {}) => {
    blogSeq += 1;
    return Blog.create({
        title: `Loan moratorium explained ${blogSeq}`,
        slug: `loan-moratorium-explained-${blogSeq}`,
        summary: 'What a loan moratorium means for borrowers, and how interest #accrues during it.',
        content: '<p>Body</p>',
        status: 'published',
        featuredImage: { url: `/uploads/linkedin-test-${process.pid}/cover.png`, fileName: `linkedin-test-${process.pid}/cover.png`, size: PNG.length },
        ...overrides
    });
};

// Completes a real OAuth round-trip through the API: authorize, then the
// callback with the state from the returned URL.
const connect = async ({ token = tokens.super } = {}) => {
    const start = await call('POST', `${L}/connection/authorize`, { token });
    assert.equal(start.status, 200, start.text);
    const state = new URL(start.body.data.authorizationUrl).searchParams.get('state');
    const cb = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
    return { start, state, cb, result: new URL(cb.location).searchParams.get('linkedin') };
};

const publishBlog = (blog, body = {}, token = tokens.editor) => call('POST', `${L}/blogs/${blog._id}/publish`, {
    token, body: { caption: 'Read our guide to loan moratoriums.', confirm: true, ...body }
});

const settled = async (blog) => {
    await publishing.waitForIdle();
    return (await call('GET', `${L}/blogs/${blog._id}/publication`, { token: tokens.editor })).body.data.publication;
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await LinkedInPublication.syncIndexes();
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'cover.png'), PNG);
    fs.writeFileSync(path.join(fixtureDir, 'cover.webp'), WEBP);

    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager' };
    for (const [key, role] of Object.entries(roles)) {
        const admin = await Admin.create({ name: `Li ${key}`, email: `li-${key}@test.local`, password: 'Password@123', role, isActive: true });
        admins[key] = admin;
        tokens[key] = generateAccessToken({ id: admin._id, role });
    }

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await publishing.waitForIdle();
    global.fetch = realFetch;
    server?.close();
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    await mongoose.disconnect();
    await mongo?.stop();
});

beforeEach(async () => {
    await publishing.waitForIdle();
    resetFake();
    await LinkedInConnection.deleteMany({});
    await LinkedInPublication.deleteMany({});
});

// ── OAuth ─────────────────────────────────────────────────────────────────────
describe('Connecting LinkedIn (OAuth)', () => {
    test('authorize returns LinkedIn\'s URL with the registered redirect URI, the configured scopes and a fresh state stored only as a hash', async () => {
        const res = await call('POST', `${L}/connection/authorize`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);
        const url = new URL(res.body.data.authorizationUrl);
        assert.equal(url.origin + url.pathname, 'https://www.linkedin.com/oauth/v2/authorization');
        assert.equal(url.searchParams.get('response_type'), 'code');
        assert.equal(url.searchParams.get('client_id'), 'testclientid01');
        assert.equal(url.searchParams.get('redirect_uri'), process.env.LINKEDIN_REDIRECT_URI);
        assert.equal(url.searchParams.get('scope'), 'w_organization_social r_organization_admin');
        const state = url.searchParams.get('state');
        assert.ok(state.length >= 43, 'a 256-bit state');
        assert.ok(!res.text.includes(process.env.LINKEDIN_CLIENT_SECRET), 'the client secret never reaches the browser');

        const raw = await LinkedInConnection.collection.findOne({});
        assert.notEqual(raw.pendingAuthorization.stateHash, state);
        assert.equal(raw.pendingAuthorization.stateHash, connectionService.hashState(state));
        assert.ok(!JSON.stringify(raw).includes(state), 'the raw state is not stored');
    });

    test('a valid callback connects: tokens are stored encrypted, the role is verified, and the browser lands on the API page', async () => {
        const { cb, result } = await connect();
        assert.equal(cb.status, 303);
        assert.equal(result, 'connected');
        assert.ok(cb.location.startsWith('https://cms.surjitfinance.com/integrations/api?'));
        assert.ok(!cb.location.includes(AUTH_CODE) && !cb.location.includes('state='), 'nothing from the callback is reflected');

        const exchange = callsTo('/oauth/v2/accessToken')[0];
        assert.equal(exchange.body.grant_type, 'authorization_code');
        assert.equal(exchange.body.code, AUTH_CODE);
        assert.equal(exchange.body.redirect_uri, process.env.LINKEDIN_REDIRECT_URI);

        const raw = await LinkedInConnection.collection.findOne({});
        assert.ok(!JSON.stringify(raw).includes(ACCESS), 'no plaintext token in the database');
        assert.equal(decrypt(raw.encryptedAccessToken), ACCESS);
        assert.equal(raw.organizationId, '1234567');
        assert.equal(raw.roleVerification.status, 'verified');
        assert.equal(raw.roleVerification.role, 'ADMINISTRATOR');
        assert.equal(String(raw.connectedBy), String(admins.super._id));
        assert.equal(raw.pendingAuthorization, null, 'the state is consumed');

        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.state, 'connected');
        assert.equal(status.body.data.connection.organizationId, '1234567');
        assert.ok(!status.text.includes(ACCESS) && !status.text.includes('encrypted'), 'the status carries no token');
    });

    test('the state is single use: replaying a successful callback is refused without another token exchange', async () => {
        const { state } = await connect();
        const before = callsTo('/oauth/v2/accessToken').length;
        const replay = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
        assert.equal(new URL(replay.location).searchParams.get('linkedin'), 'invalid_state');
        assert.equal(callsTo('/oauth/v2/accessToken').length, before);
    });

    test('a forged, missing or expired state is refused before any token exchange', async () => {
        await call('POST', `${L}/connection/authorize`, { token: tokens.super });
        for (const q of [`code=${AUTH_CODE}&state=forged-state-value-1234567890`, `code=${AUTH_CODE}`]) {
            const res = await call('GET', `${L}/oauth/callback?${q}`);
            assert.equal(new URL(res.location).searchParams.get('linkedin'), 'invalid_state', q);
        }
        const start = await call('POST', `${L}/connection/authorize`, { token: tokens.super });
        const state = new URL(start.body.data.authorizationUrl).searchParams.get('state');
        await LinkedInConnection.updateOne({}, { $set: { 'pendingAuthorization.expiresAt': new Date(Date.now() - 1000) } });
        const expired = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
        assert.equal(new URL(expired.location).searchParams.get('linkedin'), 'invalid_state');
        assert.equal(callsTo('/oauth/v2/accessToken').length, 0);
    });

    test('a member who cancels is reported as cancelled, and the state cannot be reused', async () => {
        const start = await call('POST', `${L}/connection/authorize`, { token: tokens.super });
        const state = new URL(start.body.data.authorizationUrl).searchParams.get('state');
        const res = await call('GET', `${L}/oauth/callback?error=user_cancelled_authorize&error_description=nope&state=${encodeURIComponent(state)}`);
        assert.equal(new URL(res.location).searchParams.get('linkedin'), 'cancelled');
        const again = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
        assert.equal(new URL(again.location).searchParams.get('linkedin'), 'invalid_state');
        assert.equal(callsTo('/oauth/v2/accessToken').length, 0);
    });

    test('an expired code or mismatched redirect URI fails the exchange and stores nothing', async () => {
        fake.token = { status: 400, body: { error: 'invalid_redirect_uri', error_description: 'appid/redirect uri/code verifier does not match authorization code. Or authorization code expired.' } };
        const { result } = await connect();
        assert.equal(result, 'exchange_failed');
        const raw = await LinkedInConnection.collection.findOne({});
        assert.equal(raw.connectedAt ?? null, null);
        assert.equal(raw.lastAttempt.code, 'REDIRECT_URI_MISMATCH');
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.state, 'not_connected');
    });

    test('a grant without w_organization_social is refused', async () => {
        fake.token.body.scope = 'r_organization_admin';
        const { result } = await connect();
        assert.equal(result, 'missing_permission');
        assert.equal((await LinkedInConnection.collection.findOne({})).connectedAt ?? null, null);
    });

    test('a member with no posting role on the configured page is refused', async () => {
        fake.acls.body.elements = [
            { role: 'ADMINISTRATOR', organization: 'urn:li:organization:999', roleAssignee: 'urn:li:person:abc', state: 'APPROVED' },
            { role: 'ANALYST', organization: 'urn:li:organization:1234567', roleAssignee: 'urn:li:person:abc', state: 'APPROVED' }
        ];
        const { result } = await connect();
        assert.equal(result, 'no_role');
        assert.equal((await LinkedInConnection.collection.findOne({})).connectedAt ?? null, null);
    });

    test('without r_organization_admin the connection is made, with the role reported as unverified', async () => {
        fake.token.body.scope = 'w_organization_social';
        const { result } = await connect();
        assert.equal(result, 'connected');
        assert.equal(callsTo('organizationAcls').length, 0);
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.roleVerification.status, 'not_verified');
    });

    test('only admins with API Settings edit can start or remove a connection; status needs view; the callback needs no session', async () => {
        assert.equal((await call('POST', `${L}/connection/authorize`)).status, 401);
        assert.equal((await call('POST', `${L}/connection/authorize`, { token: tokens.editor })).status, 403);
        assert.equal((await call('DELETE', `${L}/connection`, { token: tokens.editor })).status, 403);
        assert.equal((await call('GET', `${L}/connection`, { token: tokens.editor })).status, 403);
        assert.equal((await call('GET', `${L}/connection`)).status, 401);
    });

    test('disconnect deletes the stored tokens and stops publishing', async () => {
        await connect();
        const res = await call('DELETE', `${L}/connection`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.connection.state, 'not_connected');
        const raw = await LinkedInConnection.collection.findOne({});
        assert.equal(raw.encryptedAccessToken, null);
        assert.equal(raw.encryptedRefreshToken, null);

        const blog = await makeBlog();
        const pub = await publishBlog(blog);
        assert.equal(pub.status, 409);
        assert.equal(pub.body.errors[0].code, 'NOT_CONNECTED');
    });
});

// ── Connection health ─────────────────────────────────────────────────────────
describe('Expiry, refresh and reconnect', () => {
    test('an expired token without a refresh token requires reconnecting, and publishing says so', async () => {
        await connect();
        await LinkedInConnection.updateOne({}, { $set: { accessTokenExpiresAt: new Date(Date.now() - 1000) } });
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.state, 'reconnect_required');
        assert.equal(status.body.data.connection.reconnectCode, 'TOKEN_EXPIRED');
        const blog = await makeBlog();
        const pub = await publishBlog(blog);
        assert.equal(pub.status, 409);
        assert.equal(pub.body.errors[0].code, 'RECONNECT_REQUIRED');
        assert.equal(callsTo('/rest/posts').length, 0);
    });

    test('a token near expiry is refreshed first when LinkedIn issued a refresh token', async () => {
        fake.token.body = { ...fake.token.body, refresh_token: REFRESH, refresh_token_expires_in: 31536000 };
        await connect();
        await LinkedInConnection.updateOne({}, { $set: { accessTokenExpiresAt: new Date(Date.now() + 60 * 1000) } });
        const blog = await makeBlog();
        assert.equal((await publishBlog(blog)).status, 202);
        const pub = await settled(blog);
        assert.equal(pub.status, 'published');
        const refresh = callsTo('/oauth/v2/accessToken').find((c) => c.body.grant_type === 'refresh_token');
        assert.equal(refresh.body.refresh_token, REFRESH);
        assert.equal(callsTo('/rest/posts')[0].headers.authorization, `Bearer ${ACCESS}-refreshed`);
    });

    test('a refused refresh requires reconnecting', async () => {
        fake.token.body = { ...fake.token.body, refresh_token: REFRESH, refresh_token_expires_in: 31536000 };
        fake.refresh = { status: 400, body: { error: 'invalid_request', error_description: 'The provided authorization grant or refresh token is invalid, expired or revoked' } };
        await connect();
        await LinkedInConnection.updateOne({}, { $set: { accessTokenExpiresAt: new Date(Date.now() - 1000) } });
        const pub = await publishBlog(await makeBlog());
        assert.equal(pub.body.errors[0].code, 'RECONNECT_REQUIRED');
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.reconnectCode, 'REFRESH_REJECTED');
    });

    test('a connection made for a different page ID requires reconnecting', async () => {
        await connect();
        await LinkedInConnection.updateOne({}, { $set: { organizationId: '7654321' } });
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.reconnectCode, 'ORGANIZATION_CHANGED');
    });
});

// ── Preview and validation ────────────────────────────────────────────────────
describe('Preview and request validation', () => {
    test('the preview shows the title, a default caption, the canonical URL, the image and the destination — and sends nothing', async () => {
        await connect();
        const blog = await makeBlog();
        const before = fake.calls.length;
        const res = await call('GET', `${L}/blogs/${blog._id}/preview`, { token: tokens.editor });
        assert.equal(res.status, 200, res.text);
        const p = res.body.data.preview;
        assert.equal(p.blog.title, blog.title);
        assert.equal(p.canonicalUrl, `https://surjitfinance.com/blogs/${blog.slug}`);
        assert.equal(p.defaultCaption, blog.summary);
        assert.equal(p.image.url, blog.featuredImage.url);
        assert.equal(p.destination.label, 'Surjit Finance Company Page');
        assert.equal(p.destination.organizationUrn, 'urn:li:organization:1234567');
        assert.equal(p.ready, true, JSON.stringify(p.blockers));
        assert.equal(fake.calls.length, before, 'opening the preview calls LinkedIn not at all');
        assert.equal(await LinkedInPublication.countDocuments(), 0, 'and records nothing');
    });

    test('the preview lists what blocks publishing: not connected, no image, a WebP image', async () => {
        const noImage = await makeBlog({ featuredImage: { url: '', fileName: '', size: 0 } });
        let p = (await call('GET', `${L}/blogs/${noImage._id}/preview`, { token: tokens.editor })).body.data.preview;
        assert.equal(p.ready, false);
        assert.deepEqual(p.blockers.map((b) => b.code).sort(), ['IMAGE_MISSING', 'NOT_CONNECTED']);

        await connect();
        const webp = await makeBlog({ featuredImage: { url: `/uploads/linkedin-test-${process.pid}/cover.webp`, fileName: 'x', size: 1 } });
        p = (await call('GET', `${L}/blogs/${webp._id}/preview`, { token: tokens.editor })).body.data.preview;
        assert.deepEqual(p.blockers.map((b) => b.code), ['IMAGE_FORMAT_UNSUPPORTED']);
    });

    test('invalid IDs, missing blogs and unpublished blogs are refused', async () => {
        await connect();
        assert.equal((await call('GET', `${L}/blogs/not-an-id/preview`, { token: tokens.editor })).status, 400);
        assert.equal((await call('POST', `${L}/blogs/not-an-id/publish`, { token: tokens.editor, body: { caption: 'x', confirm: true } })).status, 400);
        const missing = await call('GET', `${L}/blogs/${new mongoose.Types.ObjectId()}/preview`, { token: tokens.editor });
        assert.equal(missing.status, 404);
        const draft = await makeBlog({ status: 'draft' });
        const res = await publishBlog(draft);
        assert.equal(res.status, 409);
        assert.equal(res.body.errors[0].code, 'BLOG_NOT_PUBLISHED');
        assert.equal(fake.calls.filter((c) => c.url.includes('/rest/')).length, 1, 'only the role check at connect');
    });

    test('captions are validated: required, not blank, within the limit; confirmation must be literally true', async () => {
        await connect();
        const blog = await makeBlog();
        const cases = [
            [{ caption: '' }, 'CAPTION_REQUIRED'],
            [{ caption: '   \n\t ' }, 'CAPTION_REQUIRED'],
            [{ caption: 'x'.repeat(2801) }, 'CAPTION_TOO_LONG'],
            [{ confirm: false }, 'CONFIRMATION_REQUIRED']
        ];
        for (const [body, code] of cases) {
            const res = await publishBlog(blog, body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.equal(res.body.errors[0].code, code, JSON.stringify(body));
        }
        for (const body of [{ confirm: 'true' }, { caption: 42 }, { confirm: undefined }]) {
            assert.equal((await publishBlog(blog, body)).status, 400, JSON.stringify(body));
        }
        assert.equal(await LinkedInPublication.countDocuments(), 0);
    });

    test('a role that can only view blogs can read the status but cannot preview or publish', async () => {
        await connect();
        const blog = await makeBlog();
        assert.equal((await call('GET', `${L}/blogs/${blog._id}/preview`, { token: tokens.content })).status, 403);
        assert.equal((await publishBlog(blog, {}, tokens.content)).status, 403);
        assert.equal((await call('POST', `${L}/blogs/${blog._id}/resolve`, { token: tokens.content, body: { outcome: 'not_published' } })).status, 403);
        assert.equal((await call('GET', `${L}/blogs/${blog._id}/publication`, { token: tokens.content })).status, 200);
        assert.equal((await publishBlog(blog, {}, null)).status, 401);
        assert.equal(callsTo('/rest/posts').length, 0);
    });
});

// ── Publishing ────────────────────────────────────────────────────────────────
describe('Publishing a blog', () => {
    test('a confirmed publish uploads the image, waits for it, creates one article post as the page, and records the post ID', async () => {
        await connect();
        const blog = await makeBlog();
        const blogBefore = (await Blog.findById(blog._id).lean());
        const res = await publishBlog(blog, {
            caption: 'Moratorium? Read this (2 min) #loans — ask us @ any branch',
            // Anything the browser adds about the destination is ignored.
            author: 'urn:li:organization:666', organizationId: '666', imageUrl: 'http://169.254.169.254/latest'
        });
        assert.equal(res.status, 202, res.text);
        assert.equal(res.body.data.publication.status, 'publishing');

        const pub = await settled(blog);
        assert.equal(pub.status, 'published', JSON.stringify(pub));
        assert.equal(pub.postUrn, 'urn:li:share:6844785523593134080');
        assert.equal(pub.postUrl, '', 'no viewing URL is invented for a share URN');
        assert.equal(pub.organizationId, '1234567');
        assert.ok(pub.publishedAt);
        assert.equal(pub.publishedBy.name, 'Li editor');

        const order = fake.calls.slice(-5).map((c) => `${c.method} ${c.url.split('?')[0].replace('https://', '')}`);
        assert.deepEqual(order, [
            'POST api.linkedin.com/rest/images',
            'PUT www.linkedin.com/dms-uploads/C4E/uploaded-image/0',
            'GET api.linkedin.com/rest/images/urn%3Ali%3Aimage%3AC4E10AQF',
            'GET api.linkedin.com/rest/images/urn%3Ali%3Aimage%3AC4E10AQF',
            'POST api.linkedin.com/rest/posts'
        ]);
        const init = callsTo('initializeUpload')[0];
        assert.deepEqual(init.body, { initializeUploadRequest: { owner: 'urn:li:organization:1234567' } });
        const upload = callsTo('dms-uploads', 'PUT')[0];
        assert.equal(upload.headers.authorization, `Bearer ${ACCESS}`);
        assert.equal(upload.headers['content-type'], 'image/png');
        assert.ok(Buffer.from(upload.body).equals(PNG), 'the stored image bytes, read from storage');

        const post = callsTo('/rest/posts')[0];
        assert.equal(post.headers['linkedin-version'], '202610');
        assert.equal(post.headers['x-restli-protocol-version'], '2.0.0');
        assert.equal(post.body.author, 'urn:li:organization:1234567');
        assert.equal(post.body.visibility, 'PUBLIC');
        assert.equal(post.body.lifecycleState, 'PUBLISHED');
        assert.deepEqual(post.body.distribution, { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] });
        assert.deepEqual(post.body.content.article, {
            source: `https://surjitfinance.com/blogs/${blog.slug}`,
            thumbnail: 'urn:li:image:C4E10AQF',
            title: blog.title,
            description: blog.summary
        });
        assert.equal(post.body.commentary,
            `Moratorium? Read this \\(2 min\\) #loans — ask us \\@ any branch\n\nhttps://surjitfinance.com/blogs/${blog.slug}`);

        const record = await LinkedInPublication.findOne({ blog: blog._id }).lean();
        assert.equal(record.caption, 'Moratorium? Read this (2 min) #loans — ask us @ any branch');
        assert.equal(record.attempts.length, 1);
        assert.equal(record.attempts[0].outcome, 'published');
        assert.equal(String(record.attempts[0].by), String(admins.editor._id));
        assert.ok(!JSON.stringify(record).includes(ACCESS), 'no token in the publication record');

        const blogAfter = await Blog.findById(blog._id).lean();
        assert.deepEqual(blogAfter, blogBefore, 'the blog itself is untouched');
    });

    test('a blog already published to LinkedIn is not posted again', async () => {
        await connect();
        const blog = await makeBlog();
        await publishBlog(blog);
        await settled(blog);
        const again = await publishBlog(blog);
        assert.equal(again.status, 409);
        assert.equal(again.body.errors[0].code, 'ALREADY_PUBLISHED');
        assert.equal(callsTo('/rest/posts').length, 1);
    });

    test('two simultaneous publishes of the same blog produce exactly one post', async () => {
        await connect();
        const blog = await makeBlog();
        const results = await Promise.all([publishBlog(blog), publishBlog(blog), publishBlog(blog)]);
        const statuses = results.map((r) => r.status).sort();
        assert.deepEqual(statuses, [202, 409, 409], results.map((r) => r.text).join('\n'));
        const pub = await settled(blog);
        assert.equal(pub.status, 'published');
        assert.equal(callsTo('/rest/posts').length, 1);
        assert.equal(callsTo('initializeUpload').length, 1);
    });

    test('an image the upload refuses fails without posting, and can be retried explicitly', async () => {
        await connect();
        const blog = await makeBlog();
        fake.upload.status = 415;
        await publishBlog(blog);
        let pub = await settled(blog);
        assert.equal(pub.status, 'failed');
        assert.equal(pub.error.code, 'IMAGE_REJECTED');
        assert.equal(callsTo('/rest/posts').length, 0);

        fake.upload.status = 201;
        assert.equal((await publishBlog(blog)).status, 202);
        pub = await settled(blog);
        assert.equal(pub.status, 'published');
        assert.equal(pub.attemptCount, 2);
    });

    test('an image LinkedIn cannot process, or is still processing after waiting, fails without posting', async () => {
        await connect();
        const a = await makeBlog();
        fake.imageStatuses = ['PROCESSING_FAILED'];
        await publishBlog(a);
        assert.equal((await settled(a)).error.code, 'IMAGE_PROCESSING_FAILED');

        const b = await makeBlog();
        fake.imageStatuses = ['PROCESSING'];
        await publishBlog(b);
        const pub = await settled(b);
        assert.equal(pub.status, 'failed');
        assert.equal(pub.error.code, 'IMAGE_PROCESSING_TIMEOUT');
        assert.equal(callsTo('/rest/posts').length, 0);
    });

    test('LinkedIn refusing the post (permission) is a known failure with an actionable message', async () => {
        await connect();
        const blog = await makeBlog();
        fake.post = { status: 403, code: 'ACCESS_DENIED' };
        await publishBlog(blog);
        const pub = await settled(blog);
        assert.equal(pub.status, 'failed');
        assert.equal(pub.error.code, 'ACCESS_DENIED');
        assert.match(pub.error.message, /Administrator, Content Admin or Direct Sponsored Content Poster/);
        assert.ok(!pub.error.message.includes('secret details from LinkedIn'), 'LinkedIn\'s body is not passed on');
    });

    test('a rate-limited upload start fails cleanly', async () => {
        await connect();
        const blog = await makeBlog();
        fake.init = { status: 429, body: { status: 429 } };
        await publishBlog(blog);
        const pub = await settled(blog);
        assert.equal(pub.error.code, 'RATE_LIMITED');
        assert.equal(callsTo('/rest/posts').length, 0);
    });

    test('a rejected token stops publishing and marks the connection for reconnecting', async () => {
        await connect();
        const blog = await makeBlog();
        fake.post = { status: 401, code: 'EMPTY_ACCESS_TOKEN' };
        await publishBlog(blog);
        const pub = await settled(blog);
        assert.equal(pub.status, 'failed');
        assert.equal(pub.error.code, 'TOKEN_REJECTED');
        const status = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.equal(status.body.data.connection.state, 'reconnect_required');
        assert.equal(status.body.data.connection.reconnectCode, 'TOKEN_REJECTED');
    });

    test('a post request that times out is "unknown" and is never retried automatically', async () => {
        await connect();
        const blog = await makeBlog();
        fake.post = { timeout: true };
        await publishBlog(blog);
        let pub = await settled(blog);
        assert.equal(pub.status, 'unknown');
        assert.equal(pub.error.code, 'POST_UNCONFIRMED');
        assert.equal(callsTo('/rest/posts').length, 1);

        fake.post = { status: 201, id: 'urn:li:share:1' };
        const retry = await publishBlog(blog);
        assert.equal(retry.status, 409);
        assert.equal(retry.body.errors[0].code, 'OUTCOME_UNKNOWN');
        assert.equal(callsTo('/rest/posts').length, 1, 'no second post request');

        // The admin checks the page, finds nothing, and says so; then retries.
        const resolved = await call('POST', `${L}/blogs/${blog._id}/resolve`, { token: tokens.editor, body: { outcome: 'not_published' } });
        assert.equal(resolved.status, 200, resolved.text);
        assert.equal(resolved.body.data.publication.status, 'failed');
        assert.equal((await publishBlog(blog)).status, 202);
        pub = await settled(blog);
        assert.equal(pub.status, 'published');
        assert.equal(callsTo('/rest/posts').length, 2);
    });

    test('a server error or a 201 without a post ID is also "unknown"', async () => {
        await connect();
        const a = await makeBlog();
        fake.post = { status: 500 };
        await publishBlog(a);
        assert.equal((await settled(a)).status, 'unknown');

        const b = await makeBlog();
        fake.post = { status: 201, id: '' };
        await publishBlog(b);
        const pub = await settled(b);
        assert.equal(pub.status, 'unknown');
        assert.equal(pub.error.code, 'POST_ID_MISSING');
    });

    test('an unknown outcome can be recorded as published with the post URN; a ugcPost gets LinkedIn\'s documented URL', async () => {
        await connect();
        const blog = await makeBlog();
        fake.post = { timeout: true };
        await publishBlog(blog);
        await settled(blog);
        const bad = await call('POST', `${L}/blogs/${blog._id}/resolve`, { token: tokens.editor, body: { outcome: 'published', postUrn: 'https://evil.example' } });
        assert.equal(bad.status, 400);
        const ok = await call('POST', `${L}/blogs/${blog._id}/resolve`, { token: tokens.editor, body: { outcome: 'published', postUrn: 'urn:li:ugcPost:68447855235931240' } });
        assert.equal(ok.status, 200, ok.text);
        assert.equal(ok.body.data.publication.status, 'published');
        assert.equal(ok.body.data.publication.postUrl, 'https://www.linkedin.com/feed/update/urn:li:ugcPost:68447855235931240/');
        const nothing = await call('POST', `${L}/blogs/${blog._id}/resolve`, { token: tokens.editor, body: { outcome: 'not_published' } });
        assert.equal(nothing.status, 409);
    });

    test('a publication interrupted by a restart is recovered: failed before the post request, unknown during it', async () => {
        const old = new Date(Date.now() - 11 * 60 * 1000);
        const a = await makeBlog();
        const b = await makeBlog();
        await LinkedInPublication.create({ blog: a._id, organizationId: '1234567', status: 'publishing', stage: 'uploading_image', lastAttemptAt: old });
        await LinkedInPublication.create({ blog: b._id, organizationId: '1234567', status: 'publishing', stage: 'creating_post', lastAttemptAt: old });
        const pa = (await call('GET', `${L}/blogs/${a._id}/publication`, { token: tokens.editor })).body.data.publication;
        const pb = (await call('GET', `${L}/blogs/${b._id}/publication`, { token: tokens.editor })).body.data.publication;
        assert.deepEqual([pa.status, pa.error.code], ['failed', 'INTERRUPTED']);
        assert.deepEqual([pb.status, pb.error.code], ['unknown', 'INTERRUPTED']);
    });

    test('images outside the CMS\'s storage are never fetched', async () => {
        await connect();
        const blog = await makeBlog({ featuredImage: { url: 'http://169.254.169.254/latest/meta-data', fileName: '', size: 0 } });
        const res = await publishBlog(blog);
        assert.equal(res.status, 409);
        assert.equal(res.body.errors[0].code, 'IMAGE_UNAVAILABLE');
        const traversal = await makeBlog({ featuredImage: { url: '/uploads/../../.env', fileName: '', size: 0 } });
        assert.equal((await publishBlog(traversal)).body.errors[0].code, 'IMAGE_UNAVAILABLE');
        assert.equal(fake.calls.filter((c) => !c.url.includes('linkedin.com')).length, 0);
    });
});

// ── Existing blog behaviour ───────────────────────────────────────────────────
describe('Existing blog behaviour', () => {
    test('creating, editing, publishing and the public page are unchanged by a LinkedIn publication', async () => {
        await connect();
        const blog = await makeBlog({ status: 'draft' });
        const edit = await call('PUT', `/v1/blogs/${blog._id}`, { token: tokens.editor, body: { title: 'Edited title' } });
        assert.equal(edit.status, 200, edit.text);
        assert.equal((await call('PATCH', `/v1/blogs/${blog._id}/publish`, { token: tokens.editor })).status, 200);
        await publishBlog(blog);
        await settled(blog);
        const pub = await call('GET', `/public/blogs/${blog.slug}`);
        assert.equal(pub.status, 200);
        assert.equal(pub.body.data.blog.title, 'Edited title');
        assert.equal((await call('PATCH', `/v1/blogs/${blog._id}/unpublish`, { token: tokens.editor })).status, 200);
        assert.equal((await call('GET', `/public/blogs/${blog.slug}`)).status, 404);
    });
});

// ── Environment precedence ────────────────────────────────────────────────────
describe('Settings managed by the server environment', () => {
    test('values set in the environment are reported as such, and the secret is still never returned', async () => {
        const res = await call('GET', `${L}/config`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.deepEqual(c.clientId, { value: 'testclientid01', source: 'environment' });
        assert.deepEqual(c.clientSecret, { configured: true, source: 'environment', readable: true });
        assert.equal(c.organizationId.source, 'environment');
        assert.equal(c.apiVersion.source, 'environment');
        assert.equal(c.scopes.source, 'environment');
        assert.ok(!res.text.includes(process.env.LINKEDIN_CLIENT_SECRET));
    });

    test('the CMS cannot override an environment-managed value', async () => {
        for (const body of [{ clientId: 'otherclient99' }, { clientSecret: 'AnotherSecret123' }, { organizationId: '999' }, { apiVersion: '202609' }, { verifyRole: false }]) {
            const res = await call('PUT', `${L}/config`, { token: tokens.super, body });
            assert.equal(res.status, 409, JSON.stringify(body));
            assert.equal(res.body.errors[0].code, 'MANAGED_BY_ENVIRONMENT');
        }
        const raw = await LinkedInConnection.collection.findOne({});
        assert.equal(raw, null, 'nothing was stored');
    });
});

// ── Pure helpers and logs ─────────────────────────────────────────────────────
describe('Helpers and logging', () => {
    test('little-text escaping keeps hashtags and escapes every other reserved character', () => {
        assert.equal(publishing.escapeLittle('#loans and #EMI'), '#loans and #EMI');
        assert.equal(publishing.escapeLittle('a#b # c'), 'a\\#b \\# c');
        assert.equal(publishing.escapeLittle('|{}@[]()<>\\*_~'), '\\|\\{\\}\\@\\[\\]\\(\\)\\<\\>\\\\\\*\\_\\~');
    });

    test('captions are normalised: CRLF, tabs, control characters and blank-line runs', () => {
        assert.equal(publishing.normalizeCaption('  a\r\n\r\n\r\n\r\nb\tc\u0007 '), 'a\n\nb c');
    });

    test('image types come from the bytes', () => {
        assert.equal(publishing.sniffImageType(PNG), 'image/png');
        assert.equal(publishing.sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
        assert.equal(publishing.sniffImageType(Buffer.from('GIF89a......')), 'image/gif');
        assert.equal(publishing.sniffImageType(WEBP), 'image/webp');
        assert.equal(publishing.sniffImageType(Buffer.from('<svg>')), '');
    });

    test('the request log redacts code and state', () => {
        assert.equal(redactUrl('/api/v1/linkedin/oauth/callback?code=abc&state=def&x=1'), '/api/v1/linkedin/oauth/callback?code=REDACTED&state=REDACTED&x=1');
        assert.equal(redactUrl('/api/health'), '/api/health');
    });

    test('no token, authorization code, state or client secret was written to any log during this suite', () => {
        const all = logLines.join('\n');
        assert.ok(logLines.length > 0, 'logs were captured');
        for (const secret of [ACCESS, REFRESH, AUTH_CODE, process.env.LINKEDIN_CLIENT_SECRET]) {
            assert.ok(!all.includes(secret), `log contains ${secret.slice(0, 8)}…`);
        }
        assert.ok(!/state=[A-Za-z0-9_-]{20,}/.test(all), 'no raw state in a logged URL');
        assert.ok(all.includes('code=REDACTED'), 'the callback was logged, redacted');
    });
});
