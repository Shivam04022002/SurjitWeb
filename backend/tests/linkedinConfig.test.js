// LinkedIn settings entered on Admin → API Settings: saving and redacting the
// app credentials, Test Configuration (readiness vs live), OAuth with the
// saved settings, and what a settings change does to an existing connection
// — end-to-end over HTTP against an in-memory MongoDB, with LinkedIn replaced
// by a fake behind global.fetch. Nothing here reaches LinkedIn.
//
// No LINKEDIN_* credential variables are set in this suite: everything comes
// from the CMS. (The environment-precedence cases are in linkedin.test.js,
// which runs with them set.)
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-linkedin-config-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-linkedin-config-suite';
process.env.SETTINGS_ENCRYPTION_KEY = 'test-settings-key-for-linkedin-config-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';
for (const k of ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ORGANIZATION_ID', 'LINKEDIN_API_VERSION', 'LINKEDIN_SCOPES']) delete process.env[k];
process.env.LINKEDIN_REDIRECT_URI = 'https://cms-api.surjitfinance.com/api/v1/linkedin/oauth/callback';
process.env.LINKEDIN_IMAGE_POLL_MS = '5';
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
const Role = require('../src/models/Role');
const Blog = require('../src/models/Blog');
const LinkedInConnection = require('../src/models/LinkedInConnection');
const LinkedInPublication = require('../src/models/LinkedInPublication');
const { generateAccessToken } = require('../src/utils/token');
const { decrypt } = require('../src/utils/secretBox');
const logger = require('../src/utils/logger');
const publishing = require('../src/services/linkedin/linkedinPublish.service');
const configService = require('../src/services/linkedin/linkedinConfig.service');

const logLines = [];
for (const level of ['info', 'warn', 'error', 'debug']) {
    logger[level] = (...args) => { logLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
}

// ── Fake LinkedIn ─────────────────────────────────────────────────────────────

const CLIENT_ID = '86abc123def456';
const SECRET = 'WPL_AP1.s3cr3tValue.Ab12==';
const SECRET_2 = 'WPL_AP1.replacedSecret.Zz99==';
const ACCESS = 'AQX-config-suite-access-token';
const AUTH_CODE = 'AQT-config-suite-code';

let fake;
const resetFake = () => {
    fake = {
        calls: [],
        token: { status: 200, body: { access_token: ACCESS, expires_in: 5184000, scope: 'w_organization_social,r_organization_admin' } },
        acls: { status: 200, body: { elements: [{ role: 'CONTENT_ADMINISTRATOR', organization: 'urn:li:organization:1234567', roleAssignee: 'urn:li:person:abc', state: 'APPROVED' }] } }
    };
};
resetFake();

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const realFetch = global.fetch;
global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('linkedin.com')) return realFetch(url, init);
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body = init.body;
    if (typeof body === 'string' && headers['content-type'] === 'application/json') body = JSON.parse(body);
    if (typeof body === 'string' && headers['content-type'] === 'application/x-www-form-urlencoded') body = Object.fromEntries(new URLSearchParams(body));
    fake.calls.push({ url: u, method: init.method || 'GET', headers, body });
    if (u === 'https://www.linkedin.com/oauth/v2/accessToken') return json(fake.token.status, fake.token.body);
    if (u.startsWith('https://api.linkedin.com/rest/organizationAcls')) return json(fake.acls.status, fake.acls.body);
    if (u === 'https://api.linkedin.com/rest/images?action=initializeUpload') {
        return json(200, { value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/x/0', image: 'urn:li:image:CFG1' } });
    }
    if (u.startsWith('https://www.linkedin.com/dms-uploads/')) return new Response(null, { status: 201 });
    if (u.startsWith('https://api.linkedin.com/rest/images/')) return json(200, { status: 'AVAILABLE' });
    if (u === 'https://api.linkedin.com/rest/posts') return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:555' } });
    throw new Error(`Unexpected LinkedIn call ${u}`);
};
const restCalls = () => fake.calls.filter((c) => c.url.includes('/rest/'));

// ── App and fixtures ──────────────────────────────────────────────────────────

let mongo;
let server;
let baseUrl;
const tokens = {};

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await realFetch(`${baseUrl}/api${url}`, { method, headers, body: payload, redirect: 'manual' });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: parsed, text, location: res.headers.get('location') };
};

const L = '/v1/linkedin';
const VALID = { clientId: CLIENT_ID, clientSecret: SECRET, organizationId: 'urn:li:organization:1234567', apiVersion: '202609' };
const save = (body = VALID, token = tokens.super) => call('PUT', `${L}/config`, { token, body });
const runTest = (token = tokens.super) => call('POST', `${L}/config/test`, { token });
const connect = async () => {
    const start = await call('POST', `${L}/connection/authorize`, { token: tokens.super });
    assert.equal(start.status, 200, start.text);
    const state = new URL(start.body.data.authorizationUrl).searchParams.get('state');
    const cb = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
    return { start, state, result: new URL(cb.location).searchParams.get('linkedin') };
};
const status = async () => (await call('GET', `${L}/connection`, { token: tokens.super })).body.data.connection;

const fixtureDir = path.join(__dirname, '..', 'src', 'uploads', `linkedin-config-test-${process.pid}`);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await LinkedInPublication.syncIndexes();
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'cover.png'), PNG);

    await Role.create({ key: 'api_viewer', name: 'API Viewer', permissions: ['integrations.view'], status: 'Active' });
    for (const [key, role] of Object.entries({ super: 'super_admin', editor: 'editor', viewer: 'api_viewer' })) {
        const admin = await Admin.create({ name: `Cfg ${key}`, email: `cfg-${key}@test.local`, password: 'Password@123', role, isActive: true });
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

// ── Reading and saving ────────────────────────────────────────────────────────
describe('Saving the LinkedIn settings', () => {
    test('a fresh install reports what is missing, with defaults and the environment-only redirect URI', async () => {
        const res = await call('GET', `${L}/config`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.equal(c.complete, false);
        assert.deepEqual(c.problems.map((p) => p.field).sort(), ['clientId', 'clientSecret', 'organizationId']);
        assert.deepEqual(c.apiVersion, { value: '202610', source: 'default', warning: '' });
        assert.deepEqual(c.scopes.value, ['w_organization_social', 'r_organization_admin']);
        assert.equal(c.redirectUri.value, process.env.LINKEDIN_REDIRECT_URI);
        assert.equal(c.redirectUri.source, 'environment');
        assert.equal(c.clientSecret.configured, false);
    });

    test('saving stores the secret encrypted, normalises the page ID, and never returns the secret', async () => {
        const res = await save();
        assert.equal(res.status, 200, res.text);
        assert.ok(!res.text.includes(SECRET), 'the save response does not carry the secret');
        const c = res.body.data.config;
        assert.equal(c.complete, true, JSON.stringify(c.problems));
        assert.deepEqual(c.clientId, { value: CLIENT_ID, source: 'database' });
        assert.deepEqual(c.clientSecret, { configured: true, source: 'database', readable: true });
        assert.equal(c.organizationId.value, '1234567');
        assert.equal(c.apiVersion.value, '202609');
        assert.deepEqual(res.body.data.connectionImpact, []);

        const raw = await LinkedInConnection.collection.findOne({});
        assert.ok(!JSON.stringify(raw).includes(SECRET), 'no plaintext secret in the database');
        assert.equal(decrypt(raw.config.encryptedClientSecret), SECRET);

        const read = await call('GET', `${L}/config`, { token: tokens.super });
        assert.ok(!read.text.includes(SECRET) && !read.text.includes('encrypted'), 'reading never returns the secret');
        const conn = await call('GET', `${L}/connection`, { token: tokens.super });
        assert.ok(!conn.text.includes(SECRET));
    });

    test('a save without a secret, or with an empty one, keeps the stored secret; a new one replaces it', async () => {
        await save();
        assert.equal((await save({ organizationId: '7654321' })).status, 200);
        assert.equal((await save({ clientSecret: '', apiVersion: '202610' })).status, 200);
        let raw = await LinkedInConnection.collection.findOne({});
        assert.equal(decrypt(raw.config.encryptedClientSecret), SECRET);
        assert.equal(raw.config.organizationId, '7654321');

        const replaced = await save({ clientSecret: SECRET_2 });
        assert.equal(replaced.status, 200);
        assert.ok(!replaced.text.includes(SECRET_2));
        raw = await LinkedInConnection.collection.findOne({});
        assert.equal(decrypt(raw.config.encryptedClientSecret), SECRET_2);
    });

    test('invalid values are refused server-side, without echoing them', async () => {
        const bad = [
            [{ clientId: 'abc-!' }, 'clientId'],
            [{ clientId: 'abc' }, 'clientId'],
            [{ clientSecret: 'has spaces in it' }, 'clientSecret'],
            [{ clientSecret: 'short' }, 'clientSecret'],
            [{ organizationId: 'surjit-finance' }, 'organizationId'],
            [{ organizationId: 'urn:li:person:123' }, 'organizationId'],
            [{ apiVersion: '2026-10' }, 'apiVersion'],
            [{ apiVersion: '202613' }, 'apiVersion'],
            [{ apiVersion: '209901' }, 'apiVersion'],
            [{ verifyRole: 'yes' }, 'verifyRole'],
            [{ clientId: 12345678 }, 'clientId'],
            [{}, 'form']
        ];
        for (const [body, field] of bad) {
            const res = await save(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.equal(res.body.errors[0].field, field, JSON.stringify(body));
            for (const v of Object.values(body)) {
                if (typeof v === 'string' && v.length > 4) assert.ok(!res.body.message.includes(v) && !JSON.stringify(res.body.errors).includes(v), `echoed ${v}`);
            }
        }
        assert.equal(await LinkedInConnection.countDocuments(), 0, 'nothing was saved');
    });

    test('only API Settings edit may save or test; view may read; others are refused', async () => {
        assert.equal((await call('GET', `${L}/config`)).status, 401);
        assert.equal((await save(VALID, null)).status, 401);
        assert.equal((await runTest(null)).status, 401);
        for (const t of [tokens.editor]) {
            assert.equal((await call('GET', `${L}/config`, { token: t })).status, 403);
            assert.equal((await save(VALID, t)).status, 403);
            assert.equal((await runTest(t)).status, 403);
        }
        assert.equal((await call('GET', `${L}/config`, { token: tokens.viewer })).status, 200);
        assert.equal((await save(VALID, tokens.viewer)).status, 403);
        assert.equal((await runTest(tokens.viewer)).status, 403);
        assert.equal((await call('POST', `${L}/connection/authorize`, { token: tokens.viewer })).status, 403);
        assert.equal(await LinkedInConnection.countDocuments(), 0);
    });

    test('Connect is refused until the settings are complete', async () => {
        const res = await call('POST', `${L}/connection/authorize`, { token: tokens.super });
        assert.equal(res.status, 409);
        assert.deepEqual(res.body.errors.map((e) => e.field).sort(), ['clientId', 'clientSecret', 'organizationId']);
    });
});

// ── Test Configuration ────────────────────────────────────────────────────────
describe('Test Configuration', () => {
    test('incomplete settings: a readiness result that contacts nobody', async () => {
        const res = await runTest();
        assert.equal(res.status, 200, res.text);
        const r = res.body.data.result;
        assert.equal(r.mode, 'readiness');
        assert.equal(r.outcome, 'CONFIG_INCOMPLETE');
        assert.equal(r.title, 'Configuration incomplete');
        assert.equal(r.checks.find((c) => c.id === 'clientSecret').status, 'fail');
        assert.equal(fake.calls.length, 0);
    });

    test('saved but not connected: "authorization required", explicitly not a LinkedIn check', async () => {
        await save();
        const r = (await runTest()).body.data.result;
        assert.equal(r.mode, 'readiness');
        assert.equal(r.outcome, 'AUTHORIZATION_REQUIRED');
        assert.equal(r.title, 'Credentials saved; LinkedIn authorization required');
        assert.ok(r.checks.every((c) => c.status !== 'fail'), JSON.stringify(r.checks));
        assert.match(r.checks.find((c) => c.id === 'connection').message, /LinkedIn was not contacted/);
        assert.match(r.checks.find((c) => c.id === 'redirectUri').message, /must match/);
        assert.equal(fake.calls.length, 0, 'no LinkedIn request was made');
        const raw = await LinkedInConnection.collection.findOne({});
        assert.deepEqual([raw.lastConfigTest.mode, raw.lastConfigTest.outcome], ['readiness', 'AUTHORIZATION_REQUIRED']);
    });

    test('connected: a live, read-only request with the saved API version confirms the page role', async () => {
        await save();
        assert.equal((await connect()).result, 'connected');
        const before = fake.calls.length;
        const r = (await runTest()).body.data.result;
        assert.equal(r.mode, 'live');
        assert.equal(r.outcome, 'CONNECTED_AUTHORIZED');
        assert.equal(r.title, 'Connected and authorized');
        assert.match(r.checks.find((c) => c.id === 'organization').message, /CONTENT_ADMINISTRATOR on company page 1234567/);
        const made = fake.calls.slice(before);
        assert.equal(made.length, 1);
        assert.ok(made[0].url.startsWith('https://api.linkedin.com/rest/organizationAcls'));
        assert.equal(made[0].method, 'GET');
        assert.equal(made[0].headers['linkedin-version'], '202609', 'the saved API version is used');
        assert.equal(made[0].headers.authorization, `Bearer ${ACCESS}`);
        assert.equal(fake.calls.filter((c) => /images|posts/.test(c.url)).length, 0, 'nothing was uploaded or posted');
    });

    test('connected, but the member has lost the page role: organization access not verified', async () => {
        await save();
        await connect();
        fake.acls.body.elements = [{ role: 'ANALYST', organization: 'urn:li:organization:1234567', roleAssignee: 'urn:li:person:abc', state: 'APPROVED' }];
        const r = (await runTest()).body.data.result;
        assert.equal(r.outcome, 'NO_ORGANIZATION_ROLE');
        assert.equal(r.title, 'Organization access not verified');
        assert.equal(r.checks.find((c) => c.id === 'organization').status, 'fail');
        assert.equal((await status()).roleVerification.status, 'not_verified');
    });

    test('LinkedIn refusing the role check, a server error, or a revoked token are each reported plainly', async () => {
        await save();
        await connect();
        fake.acls = { status: 403, body: { message: 'Not enough permissions to access: secret internal detail' } };
        let r = (await runTest()).body.data.result;
        assert.equal(r.outcome, 'ORGANIZATION_NOT_VERIFIED');

        fake.acls = { status: 500, body: { message: 'internal stack trace secret' } };
        const res = await runTest();
        r = res.body.data.result;
        assert.equal(r.outcome, 'API_REQUEST_FAILED');
        assert.equal(r.title, 'LinkedIn API request failed');
        assert.ok(!res.text.includes('secret internal') && !res.text.includes('stack trace'), 'LinkedIn\'s body is not passed on');

        fake.acls = { status: 401, body: {} };
        r = (await runTest()).body.data.result;
        assert.equal(r.outcome, 'RECONNECT_REQUIRED');
        const s = await status();
        assert.deepEqual([s.state, s.reconnectCode], ['reconnect_required', 'TOKEN_REJECTED']);
    });

    test('with the role check turned off, only w_organization_social is requested and the test says access is unverified', async () => {
        await save({ ...VALID, verifyRole: false });
        fake.token.body.scope = 'w_organization_social';
        const { start, result } = await connect();
        assert.equal(new URL(start.body.data.authorizationUrl).searchParams.get('scope'), 'w_organization_social');
        assert.equal(result, 'connected');
        const r = (await runTest()).body.data.result;
        assert.equal(r.mode, 'live');
        assert.equal(r.outcome, 'ORGANIZATION_NOT_VERIFIED');
        assert.equal(restCalls().length, 0, 'no role check was attempted');
        assert.match(r.checks.find((c) => c.id === 'publishing').message, /not been exercised/);
    });

    test('a stored authorization without w_organization_social reports the missing publishing permission', async () => {
        await save();
        await connect();
        await LinkedInConnection.updateOne({}, { $set: { scopes: ['r_organization_admin'] } });
        const r = (await runTest()).body.data.result;
        assert.equal(r.outcome, 'PUBLISHING_PERMISSION_MISSING');
        assert.equal(r.title, 'Publishing permission missing');
    });
});

// ── OAuth with saved settings ─────────────────────────────────────────────────
describe('OAuth with the saved settings', () => {
    test('authorization and token exchange use the saved client ID and secret; the state is single use', async () => {
        await save();
        const { start, state, result } = await connect();
        const url = new URL(start.body.data.authorizationUrl);
        assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
        assert.equal(url.searchParams.get('redirect_uri'), process.env.LINKEDIN_REDIRECT_URI);
        assert.ok(!start.text.includes(SECRET));
        assert.equal(result, 'connected');
        const exchange = fake.calls.find((c) => c.url.endsWith('/accessToken'));
        assert.equal(exchange.body.client_id, CLIENT_ID);
        assert.equal(exchange.body.client_secret, SECRET);

        const replay = await call('GET', `${L}/oauth/callback?code=${AUTH_CODE}&state=${encodeURIComponent(state)}`);
        assert.equal(new URL(replay.location).searchParams.get('linkedin'), 'invalid_state');
        assert.equal(fake.calls.filter((c) => c.url.endsWith('/accessToken')).length, 1);
    });

    test('a stored secret that can no longer be decrypted is reported, not used', async () => {
        await save();
        await LinkedInConnection.updateOne({}, { $set: { 'config.encryptedClientSecret.data': 'AAAA' } });
        const c = (await call('GET', `${L}/config`, { token: tokens.super })).body.data.config;
        assert.equal(c.clientSecret.readable, false);
        assert.ok(c.problems.some((p) => p.field === 'clientSecret' && /decrypted/.test(p.problem)));
        assert.equal((await call('POST', `${L}/connection/authorize`, { token: tokens.super })).status, 409);
    });
});

// ── Changing settings while connected ─────────────────────────────────────────
describe('Changing settings on an existing connection', () => {
    test('replacing only the secret, or changing the API version, keeps the connection', async () => {
        await save();
        await connect();
        let res = await save({ clientSecret: SECRET_2 });
        assert.deepEqual(res.body.data.connectionImpact, []);
        assert.equal(res.body.data.connection.state, 'connected');
        res = await save({ apiVersion: '202610' });
        assert.deepEqual(res.body.data.connectionImpact, []);
        assert.equal((await status()).state, 'connected');
    });

    test('a different client ID or page ID requires reconnecting — and says so in the save response', async () => {
        await save();
        await connect();
        let res = await save({ clientId: '99zzz999zzz999' });
        assert.deepEqual(res.body.data.connectionImpact, ['CLIENT_CHANGED']);
        assert.deepEqual([res.body.data.connection.state, res.body.data.connection.reconnectCode], ['reconnect_required', 'CLIENT_CHANGED']);

        await save({ clientId: CLIENT_ID });
        assert.equal((await status()).state, 'connected', 'putting the original app back restores it');
        res = await save({ organizationId: '7654321' });
        assert.deepEqual(res.body.data.connectionImpact, ['ORGANIZATION_CHANGED']);
        assert.equal((await status()).reconnectCode, 'ORGANIZATION_CHANGED');
    });

    test('disconnecting keeps the saved settings', async () => {
        await save();
        await connect();
        await call('DELETE', `${L}/connection`, { token: tokens.super });
        const c = (await call('GET', `${L}/config`, { token: tokens.super })).body.data.config;
        assert.equal(c.complete, true);
        assert.equal(c.clientSecret.configured, true);
        assert.equal((await status()).state, 'not_connected');
    });
});

// ── Blog sharing with saved settings ──────────────────────────────────────────
describe('Blog sharing with CMS-configured settings', () => {
    test('saving or testing settings never publishes; a confirmed share posts once with the saved version and page', async () => {
        await save();
        await connect();
        await runTest();
        await save({ apiVersion: '202610' });
        const blog = await Blog.create({
            title: 'Config suite blog', slug: 'config-suite-blog', summary: 'Summary', content: '<p>x</p>', status: 'published',
            featuredImage: { url: `/uploads/linkedin-config-test-${process.pid}/cover.png`, fileName: 'x', size: 1 }
        });
        assert.equal(fake.calls.filter((c) => c.url.includes('/rest/posts')).length, 0, 'nothing posted by configuring');
        assert.equal(await LinkedInPublication.countDocuments(), 0);

        const pub = await call('POST', `${L}/blogs/${blog._id}/publish`, { token: tokens.super, body: { caption: 'Hello', confirm: true } });
        assert.equal(pub.status, 202, pub.text);
        await publishing.waitForIdle();
        const posts = fake.calls.filter((c) => c.url.includes('/rest/posts'));
        assert.equal(posts.length, 1);
        assert.equal(posts[0].headers['linkedin-version'], '202610');
        assert.equal(posts[0].body.author, 'urn:li:organization:1234567');
        const again = await call('POST', `${L}/blogs/${blog._id}/publish`, { token: tokens.super, body: { caption: 'Hello', confirm: true } });
        assert.equal(again.body.errors[0].code, 'ALREADY_PUBLISHED');
    });
});

// ── Helpers and logs ──────────────────────────────────────────────────────────
describe('Validation helpers and logs', () => {
    test('page IDs, versions and redirect URIs are normalised and checked', () => {
        assert.equal(configService.normalizeOrganizationId(' urn:li:organization:0012345 '), '12345');
        assert.equal(configService.normalizeOrganizationId('12a'), null);
        assert.equal(configService.versionProblem('202610', new Date('2026-10-22')), '');
        assert.match(configService.versionProblem('202611', new Date('2026-10-22')), /future/);
        assert.match(configService.versionWarning('202511', new Date('2026-10-22')), /11 months old/);
        assert.equal(configService.redirectUriProblem('https://cms-api.surjitfinance.com/api/v1/linkedin/oauth/callback'), '');
        assert.match(configService.redirectUriProblem('https://evil.example/steal'), /callback path/);
        assert.match(configService.redirectUriProblem('http://cms-api.surjitfinance.com/api/v1/linkedin/oauth/callback'), /HTTPS/);
        assert.match(configService.redirectUriProblem('https://x.example/api/v1/linkedin/oauth/callback#a'), /fragment/);
    });

    test('no secret, token or authorization code reached any log', () => {
        const all = logLines.join('\n');
        assert.ok(logLines.length > 0);
        for (const s of [SECRET, SECRET_2, ACCESS, AUTH_CODE]) assert.ok(!all.includes(s), `log contains ${s.slice(0, 8)}…`);
    });
});
