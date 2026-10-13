// The split Email configuration: Microsoft credentials saved from the API page
// (PUT /provider), recipients and the notification preference from Email
// Settings (PUT /recipients) — two halves of the one EmailSetting document.
// Real app, in-memory MongoDB; only Microsoft is faked. No real email is sent.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-email-provider-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-email-provider-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.EMAIL_TEST_RATE_LIMIT_MAX = '1000';
process.env.LOAN_RATE_LIMIT_MAX = '10000';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const EmailSetting = require('../src/models/EmailSetting');
const LoanApplicationNotification = require('../src/models/LoanApplicationNotification');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const { decrypt } = require('../src/utils/secretBox');
const graph = require('../src/services/email/microsoftGraph');
const notifications = require('../src/services/email/loanNotification.service');

const SECRET = 'Qx8~Provider.Suite_Secret-0123456789abcdWXYZ';
const OTHER_SECRET = 'Zz9~Provider.Other_Secret-0123456789abcdQRST';
const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const CLIENT = '11111111-2222-3333-4444-555555555555';

const provider = (overrides = {}) => ({
    tenantId: TENANT, clientId: CLIENT, clientSecret: SECRET,
    senderEmail: 'Sender@Example.test', senderName: 'Surjit Finance', ...overrides
});
const recipients = (overrides = {}) => ({
    primaryRecipient: 'Primary@Example.test', additionalRecipients: ['second@example.test'],
    notifyNewLoanApplication: true, ...overrides
});

// ── Output capture ─────────────────────────────────────────────────────────────
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
const ms = { tokens: [], sends: [], reset() { this.tokens = []; this.sends = []; } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        ms.tokens.push(Object.fromEntries(new URLSearchParams(init.body)));
        return new Response(JSON.stringify({ access_token: `${b64({})}.${b64({ roles: ['Mail.Send'] })}.tok`, expires_in: 3599 }), { status: 200 });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        const ct = new Headers(init.headers).get('content-type');
        ms.sends.push({ url: u, body: ct === 'application/json' ? JSON.parse(init.body) : Buffer.from(init.body, 'base64').toString('utf8') });
        return new Response(null, { status: 202 });
    }
    return realFetch(url, init);
};

// ── Helpers ────────────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};
const responses = [];

const call = async (method, url, { token = tokens.super, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await realFetch(`${baseUrl}/api${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    responses.push(text);
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text };
};
const saveProvider = (body, token) => call('PUT', '/v1/email-settings/provider', { body, token });
const saveRecipients = (body, token) => call('PUT', '/v1/email-settings/recipients', { body, token });
const getConfig = (token) => call('GET', '/v1/email-settings', { token });
const stored = () => EmailSetting.findOne({ key: 'default' }).select('+encryptedClientSecret').lean();
const fields = (res) => (res.body?.errors || []).map((e) => e.field);

let n = 0;
const submitApplication = async () => {
    n += 1;
    const res = await call('POST', '/loan-application', {
        token: null,
        body: {
            fullName: `Applicant ${n}`, email: `applicant${n}@example.test`, phone: '9876543210', dob: '1990-01-01', gender: 'female',
            pan: 'ABCDE1234F', aadhaar: '123412341234', address: 'Road 1', city: 'Lucknow', state: 'UP', pincode: '226001',
            loanType: 'business', loanAmount: 100000, loanPurpose: 'Stock', tenure: 12, employmentType: 'salaried',
            monthlyIncome: 50000, workExperience: '3 years', consentAccepted: true
        }
    });
    await notifications.whenIdle();
    return res;
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await LoanApplicationNotification.init();
    await Role.create({ key: 'integrations_viewer', name: 'Integrations Viewer', permissions: ['integrations.view'] });
    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'integrations_viewer' };
    for (const [k, role] of Object.entries(roles)) {
        const a = await Admin.create({ name: `Test ${k}`, email: `${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
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

beforeEach(() => { ms.reset(); graph.clearTokenCache(); });

describe('authorization', () => {
    test('no session: both new endpoints refuse with 401', async () => {
        assert.equal((await saveProvider(provider(), null)).status, 401);
        assert.equal((await saveRecipients(recipients(), null)).status, 401);
    });

    test('Editor and Content Manager are refused; view-only may read but not save', async () => {
        for (const who of ['editor', 'content', 'viewer']) {
            assert.equal((await saveProvider(provider(), tokens[who])).status, 403, who);
            assert.equal((await saveRecipients(recipients(), tokens[who])).status, 403, who);
        }
        assert.equal((await getConfig(tokens.viewer)).status, 200);
        assert.equal((await getConfig(tokens.editor)).status, 403);
        assert.equal(await EmailSetting.countDocuments(), 0);
    });
});

describe('nothing saved yet', () => {
    test('both halves report what is missing', async () => {
        const c = (await getConfig()).body.data.config;
        assert.equal(c.saved, false);
        assert.equal(c.provider.configured, false);
        assert.match(c.provider.missing[0], /API section/);
        assert.deepEqual(c.recipients, { configured: false, missing: ['Primary notification recipient'] });
    });

    test('the first provider save needs a client secret', async () => {
        const res = await saveProvider(provider({ clientSecret: '' }));
        assert.equal(res.status, 400);
        assert.deepEqual(fields(res), ['clientSecret']);
        assert.equal(await EmailSetting.countDocuments(), 0);
    });

    test('provider input is validated; unsupported providers and methods are refused', async () => {
        for (const [body, field] of [
            [provider({ tenantId: 'common' }), 'tenantId'],
            [provider({ clientId: 'abc' }), 'clientId'],
            [provider({ senderEmail: 'nope' }), 'senderEmail'],
            [provider({ senderEmail: '' }), 'senderEmail'],
            [provider({ senderName: 'A\r\nBcc: x@y.test' }), 'senderName'],
            [provider({ clientSecret: 'has spaces in it' }), 'clientSecret'],
            [provider({ provider: 'outlook' }), 'provider'],
            [provider({ authMethod: 'smtp_basic' }), 'authMethod'],
            [provider({ provider: 'exchange', authMethod: 'smtp_basic' }), 'authMethod']
        ]) {
            const res = await saveProvider(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.ok(fields(res).includes(field), `${field} in ${fields(res)}`);
        }
        assert.ok(!responses.some((r) => r.includes('has spaces in it')), 'a rejected secret is never echoed');
    });
});

describe('the API page saves the provider', () => {
    test('credentials are stored encrypted, masked in the response, and recipients stay unset', async () => {
        const res = await saveProvider(provider());
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.equal(c.provider.configured, true);
        assert.equal(c.recipients.configured, false);
        assert.equal(c.configured, false, 'both halves are needed for "configured"');
        assert.deepEqual(c.clientSecret, { configured: true, readable: true, hint: SECRET.slice(-4) });
        assert.equal(c.settings.provider, 'microsoft365');
        assert.equal(c.settings.authMethod, 'graph');
        assert.equal(c.settings.senderEmail, 'sender@example.test');
        assert.equal(c.settings.primaryRecipient, '');
        assert.ok(!res.text.includes(SECRET));

        const doc = await stored();
        assert.equal(decrypt(doc.encryptedClientSecret), SECRET);
        assert.ok(!JSON.stringify(doc).includes(SECRET), 'never stored in plain text');
    });

    test('recipient fields sent to the provider endpoint are ignored', async () => {
        await saveProvider(provider({ clientSecret: '', primaryRecipient: 'sneaky@example.test', notifyNewLoanApplication: false }));
        const doc = await stored();
        assert.equal(doc.primaryRecipient, '');
        assert.equal(doc.notifyNewLoanApplication, true);
    });

    test('Test Connection and Send Test Email work with the provider alone', async () => {
        const conn = (await call('POST', '/v1/email-settings/test-connection')).body.data;
        assert.equal(conn.result.ok, true, conn.result.message);
        assert.equal(conn.config.lastTest.kind, 'connection');
        assert.deepEqual(ms.tokens[0], { grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET, scope: 'https://graph.microsoft.com/.default' });

        const sent = (await call('POST', '/v1/email-settings/test-email', { body: { recipient: 'Tester@Example.test' } })).body.data;
        assert.equal(sent.result.ok, true, sent.result.message);
        assert.deepEqual(ms.sends[0].body.message.toRecipients, [{ emailAddress: { address: 'tester@example.test' } }], 'only the typed test recipient');
    });

    test('a loan application with no recipients saved is skipped, not sent', async () => {
        const res = await submitApplication();
        assert.equal(res.status, 201);
        const r = await LoanApplicationNotification.findOne({ applicationNumber: res.body.data.applicationNumber }).lean();
        assert.deepEqual([r.status, r.outcomeCode], ['skipped', 'NO_RECIPIENTS']);
        assert.equal(ms.sends.length, 0);
    });
});

describe('Email Settings saves the recipients', () => {
    test('recipients and the preference are saved; credentials, secret and last test are untouched', async () => {
        const before = await stored();
        const res = await saveRecipients(recipients());
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.equal(c.configured, true);
        assert.equal(c.recipients.configured, true);
        assert.equal(c.settings.primaryRecipient, 'primary@example.test');
        assert.deepEqual(c.settings.additionalRecipients, ['second@example.test']);

        const after = await stored();
        for (const k of ['tenantId', 'clientId', 'senderEmail', 'senderName', 'provider', 'authMethod', 'clientSecretHint']) assert.equal(after[k], before[k], k);
        assert.deepEqual(after.encryptedClientSecret, before.encryptedClientSecret);
        assert.deepEqual(after.lastTest, before.lastTest, 'a recipient change does not clear the connection test');
    });

    test('credential fields sent to the recipients endpoint are ignored', async () => {
        const before = await stored();
        await saveRecipients(recipients({ tenantId: 'evil.onmicrosoft.com', clientSecret: OTHER_SECRET, senderEmail: 'evil@example.test' }));
        const after = await stored();
        assert.equal(after.tenantId, TENANT);
        assert.equal(after.senderEmail, 'sender@example.test');
        assert.deepEqual(after.encryptedClientSecret, before.encryptedClientSecret);
    });

    test('recipients are validated', async () => {
        for (const [body, field] of [
            [recipients({ primaryRecipient: '' }), 'primaryRecipient'],
            [recipients({ primaryRecipient: 'nope' }), 'primaryRecipient'],
            [recipients({ additionalRecipients: ['bad'] }), 'additionalRecipients'],
            [recipients({ additionalRecipients: ['PRIMARY@example.test'] }), 'additionalRecipients'],
            [recipients({ additionalRecipients: ['a@x.test', 'A@X.test'] }), 'additionalRecipients'],
            [recipients({ additionalRecipients: Array.from({ length: 11 }, (_, i) => `r${i}@x.test`) }), 'additionalRecipients'],
            [recipients({ notifyNewLoanApplication: 'yes' }), 'notifyNewLoanApplication']
        ]) {
            const res = await saveRecipients(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.ok(fields(res).includes(field), `${field} in ${fields(res)}`);
        }
        assert.equal((await stored()).primaryRecipient, 'primary@example.test', 'nothing was overwritten');
    });

    test('loan applications now email the saved recipients', async () => {
        const res = await submitApplication();
        const r = await LoanApplicationNotification.findOne({ applicationNumber: res.body.data.applicationNumber }).lean();
        assert.deepEqual([r.status, r.recipientCount], ['sent', 2]);
        assert.match(ms.sends[0].body, /^To: primary@example\.test, second@example\.test\r$/m);
    });

    test('turning notifications off is respected', async () => {
        await saveRecipients(recipients({ notifyNewLoanApplication: false }));
        const res = await submitApplication();
        assert.equal((await LoanApplicationNotification.findOne({ applicationNumber: res.body.data.applicationNumber }).lean()).outcomeCode, 'DISABLED');
        assert.equal(ms.sends.length, 0);
        await saveRecipients(recipients());
    });
});

describe('the provider half after recipients exist', () => {
    test('a blank secret keeps the stored one; recipients are preserved', async () => {
        const before = await stored();
        const res = await saveProvider(provider({ clientSecret: '', senderName: 'Surjit Finance Ltd' }));
        assert.equal(res.status, 200, res.text);
        const after = await stored();
        assert.deepEqual(after.encryptedClientSecret, before.encryptedClientSecret);
        assert.equal(after.senderName, 'Surjit Finance Ltd');
        assert.equal(after.primaryRecipient, 'primary@example.test');
        assert.deepEqual(after.additionalRecipients, ['second@example.test']);
        assert.equal(after.notifyNewLoanApplication, true);
    });

    test('a new secret replaces the old and is used for the next token', async () => {
        await saveProvider(provider({ clientSecret: OTHER_SECRET }));
        assert.equal(decrypt((await stored()).encryptedClientSecret), OTHER_SECRET);
        await call('POST', '/v1/email-settings/test-connection');
        assert.equal(ms.tokens.at(-1).client_secret, OTHER_SECRET);
    });

    test('changing a credential clears the last test, so the status is not stale', async () => {
        await call('POST', '/v1/email-settings/test-connection');
        assert.equal((await getConfig()).body.data.config.lastTest.kind, 'connection');
        const c = (await saveProvider(provider({ clientSecret: '', tenantId: 'surjit.onmicrosoft.com' }))).body.data.config;
        assert.equal(c.lastTest, null);
    });

    test('the status Email Settings reads follows the provider half', async () => {
        const original = (await stored()).encryptedClientSecret;
        // An unreadable secret (encryption key changed) is reported as not configured.
        await EmailSetting.updateOne({ key: 'default' }, { $set: { encryptedClientSecret: { iv: 'AAAAAAAAAAAAAAAA', tag: 'AAAAAAAAAAAAAAAAAAAAAA==', data: 'AAAA' } } });
        let c = (await getConfig()).body.data.config;
        assert.equal(c.provider.configured, false);
        assert.ok(c.provider.missing.some((m) => /can no longer be read/.test(m)));
        assert.equal(c.recipients.configured, true);
        const conn = (await call('POST', '/v1/email-settings/test-connection')).body.data.result;
        assert.equal(conn.code, 'NOT_CONFIGURED');
        await EmailSetting.updateOne({ key: 'default' }, { $set: { encryptedClientSecret: original } });
        c = (await getConfig()).body.data.config;
        assert.equal(c.provider.configured, true);
    });
});

describe('backward compatibility', () => {
    test('the original full save still works and fills both halves', async () => {
        const res = await call('PUT', '/v1/email-settings', {
            body: { provider: 'microsoft365', authMethod: 'graph', ...provider({ clientSecret: '' }), ...recipients({ additionalRecipients: [] }) }
        });
        assert.equal(res.status, 200, res.text);
        const c = res.body.data.config;
        assert.equal(c.configured, true);
        assert.deepEqual(c.settings.additionalRecipients, []);
    });

    test('a document saved by the earlier release reads as fully configured', async () => {
        // Exactly the shape the deployed version wrote.
        const enc = (await stored()).encryptedClientSecret;
        await EmailSetting.collection.deleteMany({});
        await EmailSetting.collection.insertOne({
            key: 'default', provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance',
            senderEmail: 'legacy@example.test', tenantId: TENANT, clientId: CLIENT, encryptedClientSecret: enc,
            clientSecretHint: 'QRST', primaryRecipient: 'legacy-ops@example.test', additionalRecipients: ['legacy-two@example.test'],
            notifyNewLoanApplication: true, lastTest: { at: null, kind: null, ok: null, code: '', message: '' },
            updatedBy: null, createdAt: new Date(), updatedAt: new Date()
        });
        const c = (await getConfig()).body.data.config;
        assert.equal(c.configured, true);
        assert.equal(c.provider.configured, true);
        assert.equal(c.recipients.configured, true);
        assert.equal(c.settings.primaryRecipient, 'legacy-ops@example.test');
        assert.equal(c.clientSecret.hint, 'QRST');

        // Each half saves without disturbing the other.
        await saveRecipients(recipients({ primaryRecipient: 'legacy-ops@example.test', additionalRecipients: ['legacy-two@example.test', 'new@example.test'] }));
        await saveProvider(provider({ clientSecret: '', senderEmail: 'legacy@example.test' }));
        const doc = await stored();
        assert.deepEqual(doc.encryptedClientSecret, enc);
        assert.deepEqual(doc.additionalRecipients, ['legacy-two@example.test', 'new@example.test']);
        assert.equal(await EmailSetting.countDocuments(), 1, 'still one document');
    });
});

test('no secret or access token in any response or log line', () => {
    const all = [...responses, ...captured].join('\n');
    for (const s of [SECRET, OTHER_SECRET]) assert.ok(!all.includes(s));
    assert.ok(!/\.tok\b/.test(all));
});
