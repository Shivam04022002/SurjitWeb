// Email Delivery Log: listing, filtering, redaction, permissions and the one
// manual retry — through the real app and a real (in-memory) MongoDB. Only
// Microsoft is replaced; no real email is sent.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-delivery-log-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-delivery-log-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.EMAIL_TEST_RATE_LIMIT_MAX = '1000';
process.env.LOAN_NOTIFICATION_MAX_ATTEMPTS = '3';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const LoanApplication = require('../src/models/LoanApplication');
const LoanApplicationNotification = require('../src/models/LoanApplicationNotification');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const graph = require('../src/services/email/microsoftGraph');
const emailConfig = require('../src/services/email/emailConfig.service');
const zoned = require('../src/utils/zonedDate');

const SECRET = 'Qx8~DeliveryLog.Secret_Value-0123456789abWXYZ';

// ── Fake Microsoft ─────────────────────────────────────────────────────────────
const realFetch = global.fetch;
const ms = { sends: 0, tokens: 0, send: [], reset() { this.sends = 0; this.tokens = 0; this.send = []; } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
global.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        ms.tokens += 1;
        return new Response(JSON.stringify({ access_token: `${b64({})}.${b64({ roles: ['Mail.Send'] })}.sig`, expires_in: 3599 }), { status: 200 });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        ms.sends += 1;
        const status = ms.send.length ? ms.send.shift() : 202;
        return status === 202 ? new Response(null, { status: 202 }) : new Response(JSON.stringify({ error: { code: 'Busy' } }), { status });
    }
    return realFetch(url, init);
};

// ── Helpers ────────────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await realFetch(`${baseUrl}/api/v1/email-settings${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text };
};
const list = (qs = '', token = tokens.super) => call('GET', `/notifications${qs}`, { token });
const retry = (id, token = tokens.super) => call('POST', `/notifications/${id}/retry`, { token });

let n = 0;
const application = () => LoanApplication.create({
    fullName: `Private Person ${++n}`, email: `private${n}@example.com`, phone: '9876543210', dob: '1990-01-01', gender: 'female',
    pan: 'ABCDE1234F', aadhaar: '123412341234', address: 'Secret Street 1', city: 'Lucknow', state: 'UP', pincode: '226001',
    loanType: 'business', loanAmount: 100000, loanPurpose: 'Stock', tenure: 12, employmentType: 'salaried', monthlyIncome: 50000,
    workExperience: '3 years', consentAccepted: true
});

// A delivery record in any state, created at a chosen time.
const record = async (fields = {}, createdAt = new Date()) => {
    const app_ = await application();
    const doc = await LoanApplicationNotification.create({ application: app_._id, applicationNumber: app_.applicationNumber, ...fields });
    await LoanApplicationNotification.collection.updateOne({ _id: doc._id }, { $set: { createdAt } });
    return LoanApplicationNotification.findById(doc._id);
};
const later = () => new Date(Date.now() + 10 * 60 * 1000);

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await LoanApplicationNotification.init();
    await Role.create({ key: 'integrations_viewer', name: 'Integrations Viewer', permissions: ['integrations.view'] });
    // Sees loan applications but not API Settings: the log is not theirs.
    await Role.create({ key: 'loans_only', name: 'Loans Only', permissions: ['loanApplications.edit'] });
    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'integrations_viewer', loans: 'loans_only' };
    for (const [k, role] of Object.entries(roles)) {
        const a = await Admin.create({ name: `Test ${k}`, email: `${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
    await emailConfig.save({
        provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance', senderEmail: 'loans@surjitfinance.com',
        tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47', clientId: '11111111-2222-3333-4444-555555555555', clientSecret: SECRET,
        primaryRecipient: 'ops@surjitfinance.com', additionalRecipients: ['credit@surjitfinance.com'], notifyNewLoanApplication: true
    }, null);
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

describe('access is decided by the server', () => {
    test('no session: 401', async () => {
        assert.equal((await list('', null)).status, 401);
        assert.equal((await retry(new mongoose.Types.ObjectId(), null)).status, 401);
    });

    test('without the API Settings permission: 403, even with Loan Applications access', async () => {
        for (const who of ['editor', 'content', 'loans']) {
            assert.equal((await list('', tokens[who])).status, 403, who);
            assert.equal((await retry(new mongoose.Types.ObjectId(), tokens[who])).status, 403, who);
        }
    });

    test('view access reads the log but cannot retry', async () => {
        const r = await record({ status: 'retrying', attempts: 1, outcomeCode: 'MICROSOFT_UNAVAILABLE', nextAttemptAt: later() });
        assert.equal((await list('', tokens.viewer)).status, 200);
        assert.equal((await retry(r._id, tokens.viewer)).status, 403);
        assert.equal(ms.sends, 0);
        assert.equal((await LoanApplicationNotification.findById(r._id)).status, 'retrying', 'untouched');
        await LoanApplicationNotification.deleteOne({ _id: r._id });
    });
});

describe('an empty log', () => {
    test('returns no rows, zero counts and one page', async () => {
        const res = await list();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.notifications, []);
        assert.deepEqual(res.body.data.pagination, { page: 1, limit: 20, total: 0, pages: 1 });
        assert.deepEqual(res.body.data.counts, { pending: 0, sending: 0, retrying: 0, sent: 0, skipped: 0, failed: 0, unconfirmed: 0 });
    });
});

describe('a populated log', () => {
    const day = (d) => zoned.middayOf(d);
    before(async () => {
        await record({ status: 'sent', attempts: 1, outcomeCode: 'SENT', recipientCount: 2, sentAt: day('2026-10-01'), lastAttemptAt: day('2026-10-01') }, day('2026-10-01'));
        await record({ status: 'sent', attempts: 2, outcomeCode: 'SENT', recipientCount: 2 }, day('2026-10-05'));
        await record({ status: 'skipped', attempts: 1, outcomeCode: 'DISABLED' }, day('2026-10-05'));
        await record({ status: 'failed', attempts: 1, outcomeCode: 'ACCESS_DENIED' }, day('2026-10-08'));
        await record({ status: 'failed', attempts: 1, outcomeCode: 'SEND_UNCONFIRMED' }, day('2026-10-09'));
        await record({ status: 'retrying', attempts: 1, outcomeCode: 'MICROSOFT_UNAVAILABLE', nextAttemptAt: later() }, day('2026-10-10'));
        await record({ status: 'pending' }, day('2026-10-11'));
    });

    test('newest first, with counts per status', async () => {
        const res = await list();
        const rows = res.body.data.notifications;
        assert.equal(rows.length, 7);
        assert.ok(rows.every((r, i) => i === 0 || new Date(rows[i - 1].createdAt) >= new Date(r.createdAt)));
        assert.deepEqual(res.body.data.counts, { pending: 1, sending: 0, retrying: 1, sent: 2, skipped: 1, failed: 1, unconfirmed: 1 });
    });

    test('rows carry only delivery facts — no applicant data, addresses or secrets', async () => {
        const res = await list();
        const keys = ['applicationNumber', 'attempts', 'createdAt', 'id', 'lastAttemptAt', 'maxAttempts', 'nextAttemptAt', 'outcomeCode', 'recipientCount', 'retryable', 'sentAt', 'status'];
        for (const row of res.body.data.notifications) assert.deepEqual(Object.keys(row).sort(), keys);
        for (const s of ['Private Person', 'example.com', 'ABCDE1234F', '123412341234', 'Secret Street', 'surjitfinance.com', SECRET, '"application"', 'lockedUntil']) {
            assert.ok(!res.text.includes(s), `"${s}" must not be in the response`);
        }
    });

    test('SEND_UNCONFIRMED is its own status, apart from failed', async () => {
        const rows = (await list()).body.data.notifications;
        assert.equal(rows.find((r) => r.outcomeCode === 'SEND_UNCONFIRMED').status, 'unconfirmed');
        assert.equal(rows.find((r) => r.outcomeCode === 'ACCESS_DENIED').status, 'failed');
        const unconfirmed = (await list('?status=unconfirmed')).body.data.notifications;
        assert.deepEqual(unconfirmed.map((r) => r.outcomeCode), ['SEND_UNCONFIRMED']);
        const failed = (await list('?status=failed')).body.data.notifications;
        assert.deepEqual(failed.map((r) => r.outcomeCode), ['ACCESS_DENIED']);
    });

    test('status filter', async () => {
        const sent = (await list('?status=sent')).body.data;
        assert.equal(sent.notifications.length, 2);
        assert.ok(sent.notifications.every((r) => r.status === 'sent'));
        assert.equal(sent.pagination.total, 2);
        assert.equal(sent.counts.failed, 1, 'counts are not narrowed by the status filter');
    });

    test('date filter: business-timezone days, both ends inclusive', async () => {
        const res = await list('?from=2026-10-05&to=2026-10-08');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.notifications.map((r) => r.outcomeCode).sort(), ['ACCESS_DENIED', 'DISABLED', 'SENT']);
        assert.equal(res.body.data.counts.sent, 1, 'counts follow the date range');
        assert.equal((await list('?from=2026-10-11')).body.data.notifications.length, 1);
        assert.equal((await list('?to=2026-10-01')).body.data.notifications.length, 1);
        assert.equal((await list('?from=2026-10-05&to=2026-10-05&status=skipped')).body.data.notifications.length, 1);
    });

    test('pagination', async () => {
        const p1 = (await list('?limit=3&page=1')).body.data;
        const p3 = (await list('?limit=3&page=3')).body.data;
        assert.deepEqual(p1.pagination, { page: 1, limit: 3, total: 7, pages: 3 });
        assert.equal(p1.notifications.length, 3);
        assert.equal(p3.notifications.length, 1);
        const ids = new Set([...p1.notifications, ...(await list('?limit=3&page=2')).body.data.notifications, ...p3.notifications].map((r) => r.id));
        assert.equal(ids.size, 7, 'pages do not overlap');
        assert.deepEqual((await list('?limit=3&page=9')).body.data.notifications, []);
    });

    test('invalid filters and limits are refused', async () => {
        for (const qs of ['?limit=101', '?limit=0', '?limit=abc', '?page=0', '?page=-1', '?status=delivered', '?status=sent&status=failed',
            '?from=2026-13-01', '?from=yesterday', '?to=2026-02-31', '?from=2026-10-09&to=2026-10-01', '?from=2025-01-01&to=2026-10-01']) {
            assert.equal((await list(qs)).status, 400, qs);
        }
    });

    test('operator-shaped query keys are not filters', async () => {
        const res = await list('?status[$ne]=sent&status.$ne=sent');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.pagination.total, 7, 'ignored, not applied as a query operator');
    });

    test('only a scheduled retry is marked retryable', async () => {
        const rows = (await list()).body.data.notifications;
        assert.deepEqual(rows.filter((r) => r.retryable).map((r) => r.status), ['retrying']);
        assert.ok(rows.find((r) => r.status === 'retrying').nextAttemptAt, 'its scheduled time is shown');
        assert.equal(rows.find((r) => r.status === 'sent').nextAttemptAt, null);
    });
});

describe('manual retry', () => {
    test('a scheduled retry runs now through the normal claim, using one of its attempts', async () => {
        const r = await record({ status: 'retrying', attempts: 1, outcomeCode: 'MICROSOFT_UNAVAILABLE', nextAttemptAt: later() });
        const res = await retry(r._id);
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.notification.status, 'sent');
        assert.equal(res.body.data.notification.attempts, 2);
        assert.equal(ms.sends, 1);
        assert.equal((await retry(r._id)).status, 409, 'a sent email cannot be retried');
        assert.equal(ms.sends, 1);
    });

    test('a retry that fails again stays within the attempt limit', async () => {
        const r = await record({ status: 'retrying', attempts: 2, outcomeCode: 'MICROSOFT_UNAVAILABLE', nextAttemptAt: later() });
        ms.send = [503];
        const res = await retry(r._id);
        assert.equal(res.status, 200);
        assert.deepEqual([res.body.data.notification.status, res.body.data.notification.attempts], ['failed', 3]);
        assert.equal((await retry(r._id)).status, 409, 'the limit is not bypassed');
        assert.equal(ms.sends, 1);
    });

    test('unsafe states are refused and left untouched', async () => {
        const cases = [
            { status: 'failed', attempts: 1, outcomeCode: 'SEND_UNCONFIRMED' },
            { status: 'failed', attempts: 1, outcomeCode: 'ACCESS_DENIED' },
            { status: 'failed', attempts: 3, outcomeCode: 'MICROSOFT_UNAVAILABLE' },
            { status: 'skipped', attempts: 1, outcomeCode: 'NOT_CONFIGURED' },
            { status: 'sent', attempts: 1, outcomeCode: 'SENT' },
            { status: 'sending', attempts: 1, lockedUntil: later() },
            { status: 'pending' },
            // Microsoft asked for a wait; it is kept.
            { status: 'retrying', attempts: 1, outcomeCode: 'THROTTLED', nextAttemptAt: later() }
        ];
        for (const fields of cases) {
            const r = await record(fields);
            const before = await LoanApplicationNotification.findById(r._id).lean();
            const res = await retry(r._id);
            assert.equal(res.status, 409, JSON.stringify(fields));
            assert.deepEqual(await LoanApplicationNotification.findById(r._id).lean(), before, `unchanged: ${JSON.stringify(fields)}`);
        }
        assert.equal(ms.sends + ms.tokens, 0);
    });

    test('two retry requests at once send once', async () => {
        const r = await record({ status: 'retrying', attempts: 1, outcomeCode: 'NETWORK', nextAttemptAt: later() });
        const results = await Promise.all([retry(r._id), retry(r._id), retry(r._id)]);
        assert.equal(ms.sends, 1);
        assert.equal(results.filter((x) => x.status === 200).length >= 1, true);
        assert.ok(results.every((x) => x.status === 200 || x.status === 409));
        assert.equal((await LoanApplicationNotification.findById(r._id)).attempts, 2);
    });

    test('bad and unknown ids', async () => {
        assert.equal((await retry('not-an-id')).status, 400);
        assert.equal((await retry(new mongoose.Types.ObjectId())).status, 404);
    });

    test('retrying never touches the application itself', async () => {
        const r = await record({ status: 'retrying', attempts: 1, outcomeCode: 'TIMEOUT', nextAttemptAt: later() });
        const before = await LoanApplication.findById(r.application).lean();
        await retry(r._id);
        assert.deepEqual(await LoanApplication.findById(r.application).lean(), before);
    });
});
