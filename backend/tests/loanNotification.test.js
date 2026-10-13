// New-loan-application emails, end to end: a real submission through the
// public route, a real (in-memory) MongoDB, and the saved Email Settings.
// Only Microsoft is replaced — fetch() to login.microsoftonline.com and
// graph.microsoft.com is answered by a fake that decodes and records each
// MIME message. No real email is sent.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-loan-email-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-loan-email-suite';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.LOAN_RATE_LIMIT_MAX = '10000';
process.env.LOAN_NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.AWS_ACCESS_KEY_ID = '';
delete process.env.ADMIN_PANEL_URL;

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const env = require('../src/config/env');
const Admin = require('../src/models/Admin');
const LoanApplication = require('../src/models/LoanApplication');
const LoanApplicationNotification = require('../src/models/LoanApplicationNotification');
const EmailSetting = require('../src/models/EmailSetting');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const graph = require('../src/services/email/microsoftGraph');
const emailConfig = require('../src/services/email/emailConfig.service');
const notifications = require('../src/services/email/loanNotification.service');
const { buildLoanApplicationEmail, escapeHtml, adminApplicationsUrl } = require('../src/services/email/loanApplicationEmail');

const SECRET = 'Qx8~LoanSuite.Secret_Value-0123456789abcdWXYZ';
const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const CLIENT = '11111111-2222-3333-4444-555555555555';

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
let serial = 0;
const fakeJwt = (roles) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'RS256' })}.${b64({ roles, n: ++serial })}.sig${serial}`;
};

// A minimal MIME reader: headers, and each base64 part decoded.
const parseMime = (raw) => {
    const [head, ...rest] = raw.split('\r\n\r\n');
    const headers = Object.fromEntries(head.split('\r\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).toLowerCase(), l.slice(i + 1).trim()]; }));
    const boundary = /boundary="([^"]+)"/.exec(headers['content-type'])[1];
    const body = rest.join('\r\n\r\n');
    const parts = {};
    for (const chunk of body.split(`--${boundary}`).slice(1)) {
        if (chunk.startsWith('--')) break;
        const [ph, ...pb] = chunk.replace(/^\r\n/, '').split('\r\n\r\n');
        const type = /Content-Type: ([^;\r\n]+)/i.exec(ph)[1];
        parts[type] = Buffer.from(pb.join('').replace(/\s+/g, ''), 'base64').toString('utf8');
    }
    return { headers, parts, raw };
};

const ms = {
    tokens: 0, sends: [], token: 'ok', send: [],
    reset() { this.tokens = 0; this.sends = []; this.token = 'ok'; this.send = []; }
};
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        ms.tokens += 1;
        if (ms.token === 7000215) return json(401, { error: 'invalid_client', error_codes: [7000215] });
        return json(200, { access_token: fakeJwt(['Mail.Send']), expires_in: 3599 });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        const step = ms.send.length ? ms.send.shift() : 202;
        if (step === 'drop') throw new TypeError('fetch failed');
        const contentType = new Headers(init.headers).get('content-type');
        ms.sends.push({ url: u, contentType, mime: contentType === 'text/plain' ? parseMime(Buffer.from(init.body, 'base64').toString('utf8')) : null });
        if (step === 202) return new Response(null, { status: 202 });
        const headers = typeof step === 'object' ? { 'Retry-After': String(step.retryAfter) } : {};
        const status = typeof step === 'object' ? step.status : step;
        return json(status, { error: { code: status === 403 ? 'ErrorAccessDenied' : 'Busy' } }, headers);
    }
    return realFetch(url, init);
};

// ── Helpers ────────────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};
const responses = [];

const call = async (method, url, { token, body } = {}) => {
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

let applicant = 0;
const applicationBody = (overrides = {}) => ({
    fullName: `Asha Verma ${++applicant}`,
    email: `asha${applicant}@example.com`,
    phone: '+91 98765 43210',
    dob: '1990-04-12',
    gender: 'female',
    pan: 'ABCDE1234F',
    aadhaar: '123412341234',
    address: '12 MG Road, Sector 4',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226001',
    loanType: 'business',
    loanAmount: 500000,
    loanPurpose: 'Working capital',
    tenure: 24,
    employmentType: 'business-owner',
    monthlyIncome: 85000,
    workExperience: '6 years',
    consentAccepted: true,
    ...overrides
});

// Submits through the public route and waits for the email work it started.
const submit = async (overrides) => {
    const res = await call('POST', '/loan-application', { body: applicationBody(overrides) });
    await notifications.whenIdle();
    return res;
};

const recordFor = async (applicationNumber) => LoanApplicationNotification.findOne({ applicationNumber }).lean();

const configure = (overrides = {}) => emailConfig.save({
    provider: 'microsoft365',
    authMethod: 'graph',
    senderName: 'Surjit Finance',
    senderEmail: 'loans@surjitfinance.com',
    tenantId: TENANT,
    clientId: CLIENT,
    clientSecret: SECRET,
    primaryRecipient: 'ops@surjitfinance.com',
    additionalRecipients: ['credit@surjitfinance.com', 'branch@surjitfinance.com'],
    notifyNewLoanApplication: true,
    ...overrides
}, null);

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    // The unique index is the duplicate guard, so it must exist before any test.
    await LoanApplicationNotification.init();
    const a = await Admin.create({ name: 'Test editor', email: 'editor@test.local', password: 'Password@123', role: 'editor', isActive: true });
    tokens.editor = generateAccessToken({ id: a._id, role: 'editor' });
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

beforeEach(async () => {
    ms.reset();
    graph.clearTokenCache();
    env.ADMIN_PANEL_URL = '';
});

describe('the submission itself is unchanged', () => {
    test('a valid application is saved and answered with its reference only', async () => {
        const res = await submit();
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.message, 'Loan application submitted successfully!');
        assert.deepEqual(Object.keys(res.body.data), ['applicationNumber']);
        const saved = await LoanApplication.findOne({ applicationNumber: res.body.data.applicationNumber });
        assert.equal(saved.status, 'pending');
        assert.equal(saved.consentAccepted, true);
        assert.equal(saved.pan, 'ABCDE1234F');
    });

    test('an invalid application is refused, and nothing is queued or sent', async () => {
        await configure();
        const before = await LoanApplicationNotification.countDocuments();
        const res = await submit({ pan: 'not-a-pan' });
        assert.equal(res.status, 400);
        assert.equal(await LoanApplicationNotification.countDocuments(), before);
        assert.equal(ms.sends.length, 0);
    });

    test('an application that fails to save sends nothing', async () => {
        await configure();
        const before = await LoanApplicationNotification.countDocuments();
        const original = LoanApplication.create;
        LoanApplication.create = async () => { throw new Error('database unavailable'); };
        try {
            const res = await submit();
            assert.equal(res.status, 500);
        } finally {
            LoanApplication.create = original;
        }
        assert.equal(await LoanApplicationNotification.countDocuments(), before);
        assert.equal(ms.sends.length + ms.tokens, 0);
    });
});

describe('when email is off or not set up', () => {
    test('no Email Settings: the application saves and the email is skipped', async () => {
        await EmailSetting.deleteMany({});
        const res = await submit();
        assert.equal(res.status, 201);
        const r = await recordFor(res.body.data.applicationNumber);
        assert.equal(r.status, 'skipped');
        assert.equal(r.outcomeCode, 'NOT_CONFIGURED');
        assert.equal(ms.sends.length + ms.tokens, 0);
    });

    test('notifications turned off: skipped as DISABLED', async () => {
        await configure({ notifyNewLoanApplication: false });
        const res = await submit();
        assert.equal(res.status, 201);
        const r = await recordFor(res.body.data.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts], ['skipped', 'DISABLED', 1]);
        assert.equal(ms.sends.length, 0);
    });

    test('a saved secret that can no longer be read: skipped as NOT_CONFIGURED', async () => {
        await configure();
        const original = env.SETTINGS_ENCRYPTION_KEY;
        env.SETTINGS_ENCRYPTION_KEY = 'a-different-key-than-the-one-used-to-save';
        try {
            const res = await submit();
            assert.equal(res.status, 201);
            assert.equal((await recordFor(res.body.data.applicationNumber)).outcomeCode, 'NOT_CONFIGURED');
        } finally {
            env.SETTINGS_ENCRYPTION_KEY = original;
        }
        assert.equal(ms.sends.length + ms.tokens, 0);
    });

    test('a skipped email is not sent later by the sweep', async () => {
        await notifications.sweep();
        assert.equal(ms.sends.length, 0);
    });
});

describe('a configured mailbox', () => {
    test('one email to every configured recipient, after the save', async () => {
        await configure({ additionalRecipients: ['credit@surjitfinance.com', 'branch@surjitfinance.com'] });
        const res = await submit();
        assert.equal(res.status, 201);
        const ref = res.body.data.applicationNumber;

        assert.equal(ms.sends.length, 1);
        const { url, contentType, mime } = ms.sends[0];
        assert.equal(url, `${graph.GRAPH_BASE}/users/loans%40surjitfinance.com/sendMail`);
        assert.equal(contentType, 'text/plain', 'sent as MIME');
        assert.equal(mime.headers.to, 'ops@surjitfinance.com, credit@surjitfinance.com, branch@surjitfinance.com');
        assert.equal(mime.headers.from, '"Surjit Finance" <loans@surjitfinance.com>');
        assert.equal(mime.headers.subject, 'New Loan Application Received');
        assert.match(mime.headers['content-type'], /^multipart\/alternative/);
        assert.ok(mime.parts['text/plain'].includes(ref), 'plain-text part carries the reference');
        assert.ok(mime.parts['text/html'].includes(ref), 'HTML part carries the reference');
        assert.ok(mime.parts['text/plain'].includes('Business Loan'));

        const r = await recordFor(ref);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts, r.recipientCount], ['sent', 'SENT', 1, 3]);
        assert.ok(r.sentAt);
    });

    test('recipients come only from Email Settings, never from the submission', async () => {
        await configure({ additionalRecipients: [] });
        const res = await submit({ recipients: ['attacker@evil.test'], to: 'attacker@evil.test', notificationEmail: 'attacker@evil.test', cc: 'x@evil.test' });
        assert.equal(res.status, 201);
        assert.equal(ms.sends.length, 1);
        assert.equal(ms.sends[0].mime.headers.to, 'ops@surjitfinance.com');
        assert.ok(!ms.sends[0].mime.raw.includes('evil.test'));
    });

    test('values are escaped in HTML, and sensitive fields are left out', async () => {
        await configure();
        const res = await submit({ fullName: '<script>alert(1)</script> O\'Brien & "Sons"', email: 'secret.person@example.com' });
        assert.equal(res.status, 201);
        const { parts, raw } = ms.sends[0].mime;
        const html = parts['text/html'];
        assert.ok(!html.includes('<script>'), 'no raw script tag');
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; O&#39;Brien &amp; &quot;Sons&quot;'));
        assert.ok(parts['text/plain'].includes('<script>alert(1)</script> O\'Brien & "Sons"'), 'plain text is not HTML-escaped');

        const decoded = `${raw}\n${parts['text/plain']}\n${html}`;
        for (const sensitive of ['ABCDE1234F', '123412341234', '98765 43210', 'secret.person@example.com', '1990', 'MG Road', '226001', '85000', '500000', 'Working capital']) {
            assert.ok(!decoded.includes(sensitive), `"${sensitive}" must not be in the email`);
        }
    });

    test('the CMS link appears only when ADMIN_PANEL_URL is a real http(s) address', async () => {
        await configure();
        env.ADMIN_PANEL_URL = 'https://cms.surjitfinance.com/';
        await submit();
        let html = ms.sends.at(-1).mime.parts['text/html'];
        assert.ok(html.includes('href="https://cms.surjitfinance.com/loan-applications"'));
        assert.ok(ms.sends.at(-1).mime.parts['text/plain'].includes('https://cms.surjitfinance.com/loan-applications'));

        env.ADMIN_PANEL_URL = '';
        await submit();
        html = ms.sends.at(-1).mime.parts['text/html'];
        assert.ok(!html.includes('href='), 'no link without a configured address');

        env.ADMIN_PANEL_URL = 'javascript:alert(1)';
        await submit();
        assert.ok(!ms.sends.at(-1).mime.parts['text/html'].includes('href='), 'a non-http address is never linked');
    });

    test('reads and status changes send nothing', async () => {
        await configure();
        const res = await submit();
        ms.reset();
        const saved = await LoanApplication.findOne({ applicationNumber: res.body.data.applicationNumber });
        assert.equal((await call('GET', `/loan-application/status/${saved.applicationNumber}`)).status, 200);
        assert.equal((await call('GET', `/loan-application/${saved._id}`, { token: tokens.editor })).status, 200);
        const patch = await call('PATCH', `/loan-application/${saved._id}/status`, { token: tokens.editor, body: { status: 'under-review' } });
        assert.equal(patch.status, 200, patch.text);
        await notifications.whenIdle();
        await notifications.sweep();
        assert.equal(ms.sends.length + ms.tokens, 0);
        assert.equal(await LoanApplicationNotification.countDocuments({ application: saved._id }), 1);
    });
});

describe('delivery failures after a successful save', () => {
    test('a permanent Graph refusal is recorded; the application and response are untouched', async () => {
        await configure();
        ms.send = [403];
        const res = await submit();
        assert.equal(res.status, 201, 'the customer still sees success');
        const saved = await LoanApplication.findOne({ applicationNumber: res.body.data.applicationNumber });
        assert.equal(saved.status, 'pending', 'the business status is not touched');
        assert.equal(saved.statusHistory.length, 0);
        const r = await recordFor(saved.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts], ['failed', 'ACCESS_DENIED', 1]);

        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { nextAttemptAt: new Date(0) } });
        await notifications.sweep();
        assert.equal(ms.sends.length, 1, 'a permanent failure is not retried');
    });

    test('a rejected client secret is not retried', async () => {
        await configure();
        ms.token = 7000215;
        const res = await submit();
        const r = await recordFor(res.body.data.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode], ['failed', 'INVALID_CLIENT_SECRET']);
        assert.equal(ms.sends.length, 0);
    });

    test('a temporary failure is retried when due, and then sent', async () => {
        await configure();
        ms.send = [503];
        const res = await submit();
        let r = await recordFor(res.body.data.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts], ['retrying', 'MICROSOFT_UNAVAILABLE', 1]);
        assert.ok(r.nextAttemptAt > new Date(), 'scheduled for later');

        await notifications.sweep();
        assert.equal(ms.sends.length, 1, 'not before it is due');

        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
        await notifications.sweep();
        r = await recordFor(res.body.data.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts], ['sent', 'SENT', 2]);
        assert.equal(ms.sends.length, 2);
    });

    test('retries are bounded', async () => {
        await configure();
        ms.send = [503, 503, 503, 503, 503];
        const res = await submit();
        const ref = res.body.data.applicationNumber;
        for (let i = 0; i < 5; i++) {
            await LoanApplicationNotification.updateOne({ applicationNumber: ref, status: 'retrying' }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
            await notifications.sweep();
        }
        const r = await recordFor(ref);
        assert.deepEqual([r.status, r.outcomeCode, r.attempts], ['failed', 'MICROSOFT_UNAVAILABLE', 3]);
        assert.equal(ms.sends.length, 3, 'LOAN_NOTIFICATION_MAX_ATTEMPTS sends at most');
    });

    test('throttling waits at least as long as Microsoft asks', async () => {
        await configure();
        ms.send = [{ status: 429, retryAfter: 600 }];
        const startedAt = Date.now();
        const res = await submit();
        const r = await recordFor(res.body.data.applicationNumber);
        assert.equal(r.outcomeCode, 'THROTTLED');
        assert.ok(r.nextAttemptAt.getTime() >= startedAt + 600 * 1000);
    });

    test('a send with no answer is not retried, since it may have gone out', async () => {
        await configure();
        ms.send = ['drop'];
        const res = await submit();
        const r = await recordFor(res.body.data.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode], ['failed', 'SEND_UNCONFIRMED']);
    });
});

describe('duplicate prevention', () => {
    test('queueing the same application again sends nothing more', async () => {
        await configure();
        const res = await submit();
        const saved = await LoanApplication.findOne({ applicationNumber: res.body.data.applicationNumber });
        assert.equal(await notifications.queueForApplication(saved), null);
        assert.equal(await notifications.queueForApplication(saved), null);
        await notifications.whenIdle();
        await notifications.sweep();
        assert.equal(ms.sends.length, 1);
        assert.equal(await LoanApplicationNotification.countDocuments({ application: saved._id }), 1);
    });

    test('two workers racing for one record send once', async () => {
        await configure();
        const saved = await LoanApplication.create({ ...applicationBody(), consentAccepted: true });
        const record = await LoanApplicationNotification.create({ application: saved._id, applicationNumber: saved.applicationNumber });
        const results = await Promise.all([notifications.processRecord(record._id), notifications.processRecord(record._id), notifications.sweep()]);
        assert.equal(results.slice(0, 2).filter(Boolean).length + results[2].processed, 1, 'exactly one claim succeeded');
        assert.equal(ms.sends.length, 1);
    });

    test('a send interrupted mid-way is closed as unconfirmed, not resent', async () => {
        await configure();
        const saved = await LoanApplication.create({ ...applicationBody(), consentAccepted: true });
        await LoanApplicationNotification.create({
            application: saved._id, applicationNumber: saved.applicationNumber,
            status: 'sending', attempts: 1, lockedUntil: new Date(Date.now() - 1000)
        });
        const result = await notifications.sweep();
        assert.equal(result.interrupted, 1);
        const r = await recordFor(saved.applicationNumber);
        assert.deepEqual([r.status, r.outcomeCode], ['failed', 'SEND_UNCONFIRMED']);
        assert.equal(ms.sends.length, 0);
    });

    test('a record queued before a restart is sent by the sweep', async () => {
        await configure();
        const saved = await LoanApplication.create({ ...applicationBody(), consentAccepted: true });
        await LoanApplicationNotification.create({ application: saved._id, applicationNumber: saved.applicationNumber });
        await notifications.sweep();
        assert.equal((await recordFor(saved.applicationNumber)).status, 'sent');
        assert.equal(ms.sends.length, 1);
    });
});

describe('the template on its own', () => {
    const application = { applicationNumber: 'SF12345678', fullName: 'Ravi <b>Kumar</b>', loanType: 'lap', createdAt: new Date('2026-10-13T06:30:00Z') };

    test('subject, reference, applicant, loan and time', () => {
        const email = buildLoanApplicationEmail({ application, adminUrl: null });
        assert.equal(email.subject, 'New Loan Application Received');
        assert.match(email.text, /Reference: SF12345678/);
        assert.match(email.text, /Applicant: Ravi <b>Kumar<\/b>/);
        assert.match(email.text, /Loan: Loan Against Property/);
        assert.match(email.text, /Submitted: 13 Oct 2026/);
        assert.ok(email.html.includes('Ravi &lt;b&gt;Kumar&lt;/b&gt;'));
        assert.ok(!email.html.includes('<b>Kumar'));
    });

    test('a product name, when there is one, names the loan', () => {
        assert.match(buildLoanApplicationEmail({ application, productName: 'Shop Expansion Loan', adminUrl: null }).text, /Loan: Shop Expansion Loan/);
    });

    test('escapeHtml and the admin URL rules', () => {
        assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
        assert.equal(adminApplicationsUrl('https://cms.example.com'), 'https://cms.example.com/loan-applications');
        assert.equal(adminApplicationsUrl('https://cms.example.com/admin/?x=1#y'), 'https://cms.example.com/admin/loan-applications');
        assert.equal(adminApplicationsUrl('ftp://cms.example.com'), null);
        assert.equal(adminApplicationsUrl('not a url'), null);
        assert.equal(adminApplicationsUrl(''), null);
    });
});

test('no secret or access token appears in any response or log line', () => {
    const all = [...responses, ...captured].join('\n');
    assert.ok(!all.includes(SECRET));
    assert.ok(!/\.sig\d+/.test(all));
});
