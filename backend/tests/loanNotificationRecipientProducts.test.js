// Which recipients are emailed about each new loan application: the primary
// recipient always, additional recipients by the products assigned to them.
// Real submissions through the public route, a real (in-memory) MongoDB and
// the saved Email Settings; only Microsoft is replaced by a fake that records
// each message's To line. No real email is sent; fake applicants only.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-recipient-products';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-recipient-products';
process.env.CORS_ORIGIN = 'http://localhost:5174';
process.env.LOAN_RATE_LIMIT_MAX = '10000';
process.env.LOAN_NOTIFICATION_MAX_ATTEMPTS = '3';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.AWS_ACCESS_KEY_ID = '';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const Product = require('../src/models/Product');
const ProductCategory = require('../src/models/ProductCategory');
const LoanApplicationNotification = require('../src/models/LoanApplicationNotification');
const EmailSetting = require('../src/models/EmailSetting');
const roleService = require('../src/services/role.service');
const { generateAccessToken } = require('../src/utils/token');
const graph = require('../src/services/email/microsoftGraph');
const emailConfig = require('../src/services/email/emailConfig.service');
const notifications = require('../src/services/email/loanNotification.service');
const { recipientsFor, assignmentFor } = require('../src/services/email/emailRules');

for (const level of ['log', 'info', 'warn', 'error']) console[level] = () => {};

// ── Fake Microsoft ─────────────────────────────────────────────────────────────
const realFetch = global.fetch;
const ms = { tokens: 0, sends: [], send: [], reset() { this.tokens = 0; this.sends = []; this.send = []; } };
global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(graph.LOGIN_BASE)) {
        ms.tokens += 1;
        const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
        return new Response(JSON.stringify({ access_token: `${b64({ alg: 'RS256' })}.${b64({ roles: ['Mail.Send'], n: ms.tokens })}.sig`, expires_in: 3599 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.startsWith(graph.GRAPH_BASE)) {
        const step = ms.send.length ? ms.send.shift() : 202;
        const mime = Buffer.from(init.body, 'base64').toString('utf8');
        const to = (/^To: (.*)$/m.exec(mime)?.[1] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        ms.sends.push({ to });
        if (step === 202) return new Response(null, { status: 202 });
        return new Response(JSON.stringify({ error: { code: 'Busy' } }), { status: step, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
};

// ── Helpers ────────────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
const tokens = {};
const P = {};

const PRIMARY = 'ops@surjitfinance.com';
const MSME_DESK = 'msme@surjitfinance.com';
const VEHICLE_DESK = 'vehicle@surjitfinance.com';
const LEGACY = 'credit@surjitfinance.com';

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await realFetch(`${baseUrl}/api${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: parsed, text };
};

let applicant = 0;
// Submits through the public route (as the website does) and waits for the
// email work it started. Returns the delivery record.
const submit = async (fields = {}) => {
    applicant += 1;
    const res = await call('POST', '/loan-application', {
        body: {
            fullName: `Test Applicant ${applicant}`, email: `applicant${applicant}@example.com`, phone: '+91 98765 43210',
            dob: '1990-04-12', gender: 'female', pan: 'ABCDE1234F', aadhaar: '123412341234', address: '12 Test Road',
            city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', loanType: 'business', loanAmount: 500000,
            loanPurpose: 'Working capital', tenure: 24, employmentType: 'business-owner', monthlyIncome: 85000,
            workExperience: '6 years', consentAccepted: true, ...fields
        }
    });
    assert.equal(res.status, 201, res.text);
    await notifications.whenIdle();
    return LoanApplicationNotification.findOne({ applicationNumber: res.body.data.applicationNumber }).lean();
};
const msme = () => submit({ productId: P.msme._id });
const trade = () => submit({ productId: P.trade._id });
const erick = () => submit({ productId: P.erick._id, loanType: 'vehicle' });
const noProduct = () => submit();

const configure = () => emailConfig.save({
    provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance', senderEmail: 'loans@surjitfinance.com',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47', clientId: '11111111-2222-3333-4444-555555555555',
    clientSecret: 'Qx8~RecipientProducts.Secret_Value-0123456789', primaryRecipient: PRIMARY,
    additionalRecipients: [], notifyNewLoanApplication: true
}, null);

// Saves recipients through the page's own endpoint.
const saveRecipients = (additionalRecipients, recipientProducts, { token = tokens.super, primaryRecipient = PRIMARY } = {}) => call('PUT', '/v1/email-settings/recipients', {
    token,
    body: { primaryRecipient, additionalRecipients, notifyNewLoanApplication: true, ...(recipientProducts ? { recipientProducts } : {}) }
});
const assign = (email, ...products) => ({ email, productIds: products.map((p) => String(p._id)) });

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await LoanApplicationNotification.init();
    await Role.create({ key: 'email_viewer', name: 'Email Viewer', permissions: ['integrations.view'] });
    for (const [k, role] of Object.entries({ super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'email_viewer' })) {
        const a = await Admin.create({ name: `Routing ${k}`, email: `routing-${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
    const business = await ProductCategory.create({ name: 'Business Loan', slug: 'business-loan' });
    const vehicle = await ProductCategory.create({ name: 'Commercial Vehicle Loan', slug: 'commercial-vehicle-loan' });
    P.msme = await Product.create({ category: business._id, name: 'MSME Loan', slug: 'msme-loan', isActive: true });
    P.trade = await Product.create({ category: business._id, name: 'Trade Loan', slug: 'trade-loan', isActive: true });
    P.erick = await Product.create({ category: vehicle._id, name: 'E-Rickshaw Loan', slug: 'e-rickshaw-loan', isActive: true });
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
    await EmailSetting.deleteMany({});
    await configure();
});

describe('who is emailed', () => {
    test('the primary recipient receives every application, with or without a product', async () => {
        assert.equal((await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)])).status, 200);
        for (const r of [await msme(), await trade(), await erick(), await noProduct()]) {
            assert.equal(r.status, 'sent');
            assert.ok(r.recipients.includes(PRIMARY), r.applicationNumber);
        }
        assert.equal(ms.sends.length, 4);
    });

    test('an additional recipient receives only applications for its products; none without a product', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        assert.deepEqual((await msme()).recipients, [PRIMARY, MSME_DESK]);
        assert.deepEqual((await trade()).recipients, [PRIMARY]);
        assert.deepEqual((await noProduct()).recipients, [PRIMARY]);
        assert.deepEqual(ms.sends.map((s) => s.to), [[PRIMARY, MSME_DESK], [PRIMARY], [PRIMARY]], 'what Microsoft was asked to send');
    });

    test('several recipients with several products each', async () => {
        await saveRecipients([MSME_DESK, VEHICLE_DESK], [assign(MSME_DESK, P.msme, P.trade), assign(VEHICLE_DESK, P.erick, P.msme)]);
        assert.deepEqual((await msme()).recipients, [PRIMARY, MSME_DESK, VEHICLE_DESK]);
        assert.deepEqual((await trade()).recipients, [PRIMARY, MSME_DESK]);
        assert.deepEqual((await erick()).recipients, [PRIMARY, VEHICLE_DESK]);
        assert.deepEqual((await noProduct()).recipients, [PRIMARY]);
    });

    test('a recipient added with no products receives nothing; the primary still does', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK)]);
        assert.deepEqual((await msme()).recipients, [PRIMARY]);
        assert.deepEqual((await noProduct()).recipients, [PRIMARY]);
    });

    test('compatibility: a recipient saved before assignments existed keeps receiving every application', async () => {
        // As production is today: additional recipients and no assignments.
        await EmailSetting.updateOne({}, { $set: { additionalRecipients: [LEGACY] }, $unset: { recipientProducts: 1 } });
        assert.deepEqual((await msme()).recipients, [PRIMARY, LEGACY]);
        assert.deepEqual((await noProduct()).recipients, [PRIMARY, LEGACY]);
        // Saving the page without touching that recipient keeps it that way.
        assert.equal((await saveRecipients([LEGACY, MSME_DESK], [assign(MSME_DESK, P.msme)])).status, 200);
        assert.deepEqual((await trade()).recipients, [PRIMARY, LEGACY]);
        const view = (await call('GET', '/v1/email-settings', { token: tokens.viewer })).body.data.config.settings.recipientProducts;
        assert.deepEqual(view.map((v) => [v.email, v.allProducts, v.legacy]), [[LEGACY, true, true], [MSME_DESK, false, false]]);
        // Assigning it products ends "every application" for it.
        await saveRecipients([LEGACY, MSME_DESK], [assign(LEGACY, P.trade)]);
        assert.deepEqual((await msme()).recipients, [PRIMARY, MSME_DESK]);
        assert.deepEqual((await trade()).recipients, [PRIMARY, LEGACY]);
    });

    test('addresses are deduplicated without regard to case', () => {
        const settings = {
            primaryRecipient: 'Ops@SurjitFinance.com',
            additionalRecipients: ['ops@surjitfinance.com', 'MSME@surjitfinance.com', 'msme@SURJITFINANCE.com'],
            recipientProducts: [{ email: 'msme@surjitfinance.com', productIds: [P.msme._id] }]
        };
        assert.deepEqual(recipientsFor(settings, P.msme._id), [PRIMARY, MSME_DESK]);
        assert.deepEqual(recipientsFor(settings, { _id: P.msme._id, name: 'MSME Loan' }), [PRIMARY, MSME_DESK], 'a populated product');
        assert.deepEqual(recipientsFor(settings, null), [PRIMARY]);
        assert.deepEqual(assignmentFor({ additionalRecipients: ['x@y.z'] }, 'X@Y.Z'), { allProducts: true, productIds: [], legacy: true });
    });

    test('the product compared is the one the server saved, not anything else the browser sent', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        const r = await submit({ product: String(P.msme._id), productName: 'MSME Loan' });
        assert.deepEqual(r.recipients, [PRIMARY]);
    });

    test('turning loan emails off still stops every email', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        await EmailSetting.updateOne({}, { $set: { notifyNewLoanApplication: false } });
        assert.equal((await msme()).outcomeCode, 'DISABLED');
        assert.equal(ms.sends.length, 0);
    });
});

describe('saving assignments', () => {
    test('assignments are saved and shown with product names, in recipient order; removed recipients lose theirs', async () => {
        const res = await saveRecipients([VEHICLE_DESK, MSME_DESK], [assign(MSME_DESK, P.msme), assign(VEHICLE_DESK, P.erick)]);
        assert.equal(res.status, 200, res.text);
        const view = res.body.data.config.settings.recipientProducts;
        assert.deepEqual(view.map((v) => [v.email, v.products.map((p) => `${p.name}/${p.category}`)]), [
            [VEHICLE_DESK, ['E-Rickshaw Loan/Commercial Vehicle Loan']],
            [MSME_DESK, ['MSME Loan/Business Loan']]
        ]);
        await saveRecipients([MSME_DESK]);
        const saved = await EmailSetting.findOne({}).lean();
        assert.deepEqual(saved.recipientProducts.map((e) => e.email), [MSME_DESK], 'kept for the remaining recipient, dropped for the removed one');
        assert.deepEqual(saved.recipientProducts[0].productIds.map(String), [String(P.msme._id)]);
    });

    test('invalid, unknown and misplaced assignments are refused, and the saved ones are kept', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        const unknown = String(new mongoose.Types.ObjectId());
        const cases = [
            [[{ email: MSME_DESK, productIds: ['not-an-id'] }], /chosen from the product list/],
            [[{ email: MSME_DESK, productIds: [unknown] }], new RegExp(`not exist: ${unknown}`)],
            [[{ email: MSME_DESK, productIds: [String(P.msme._id), String(P.msme._id)] }], /more than once/],
            [[{ email: 'stranger@surjitfinance.com', productIds: [String(P.msme._id)] }], /only be assigned to additional recipients/],
            [[{ email: PRIMARY, productIds: [String(P.msme._id)] }], /only be assigned to additional recipients/],
            [[{ email: 'not an email', productIds: [] }], /valid recipient email/],
            [[{ email: MSME_DESK, productIds: [] }, { email: 'MSME@surjitfinance.com', productIds: [] }], /more than one product assignment/],
            [[{ email: MSME_DESK, productIds: [{ $ne: null }] }], /chosen from the product list/],
            [[{ email: MSME_DESK, allProducts: 'yes' }], /allProducts must be true or false/],
            ['everything', /must be a list/]
        ];
        for (const [recipientProducts, message] of cases) {
            const res = await call('PUT', '/v1/email-settings/recipients', { token: tokens.super, body: { primaryRecipient: PRIMARY, additionalRecipients: [MSME_DESK], recipientProducts } });
            assert.equal(res.status, 400, JSON.stringify(recipientProducts));
            assert.match(res.body.errors[0].message, message);
        }
        const saved = await EmailSetting.findOne({}).lean();
        assert.deepEqual(saved.recipientProducts.map((e) => [e.email, e.productIds.map(String)]), [[MSME_DESK, [String(P.msme._id)]]]);
    });

    test('only staff with API Settings edit access can change recipients or assignments', async () => {
        const body = { primaryRecipient: PRIMARY, additionalRecipients: [MSME_DESK], recipientProducts: [assign(MSME_DESK, P.trade)] };
        assert.equal((await call('PUT', '/v1/email-settings/recipients', { body })).status, 401);
        assert.equal((await call('PUT', '/v1/email-settings/recipients', { token: 'forged.x.y', body })).status, 401);
        for (const who of ['content', 'editor', 'viewer']) {
            assert.equal((await call('PUT', '/v1/email-settings/recipients', { token: tokens[who], body })).status, 403, who);
        }
        assert.deepEqual((await EmailSetting.findOne({}).lean()).additionalRecipients, []);
        // The app-wide rule this replaces is gone.
        assert.equal((await call('PUT', '/v1/email-settings/product-rules', { token: tokens.super, body: { productIds: [] } })).status, 404);
    });

    test('saving recipients and assignments leaves credentials alone, sends nothing and queues nothing', async () => {
        const before = await EmailSetting.findOne({}).select('+encryptedClientSecret').lean();
        const queued = await LoanApplicationNotification.countDocuments();
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        await saveRecipients([MSME_DESK, VEHICLE_DESK], [assign(VEHICLE_DESK, P.erick)]);
        await notifications.whenIdle();
        const afterSave = await EmailSetting.findOne({}).select('+encryptedClientSecret').lean();
        for (const k of ['senderEmail', 'tenantId', 'clientId', 'encryptedClientSecret', 'lastTest']) assert.deepEqual(afterSave[k], before[k], k);
        assert.equal(await LoanApplicationNotification.countDocuments(), queued);
        assert.equal(ms.sends.length + ms.tokens, 0);
    });

    test('saving everything at once (the older endpoint) keeps assignments it says nothing about', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        await configure();
        const saved = await EmailSetting.findOne({}).lean();
        assert.deepEqual(saved.additionalRecipients, []);
        assert.deepEqual(saved.recipientProducts, [], 'the recipient was removed, so its assignment went with it');
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        const res = await call('PUT', '/v1/email-settings', { token: tokens.super, body: {
            provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance', senderEmail: 'loans@surjitfinance.com',
            tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47', clientId: '11111111-2222-3333-4444-555555555555',
            primaryRecipient: PRIMARY, additionalRecipients: [MSME_DESK], notifyNewLoanApplication: true
        } });
        assert.equal(res.status, 200, res.text);
        assert.deepEqual((await EmailSetting.findOne({}).lean()).recipientProducts.map((e) => e.productIds.map(String)), [[String(P.msme._id)]]);
    });

    test('a product deleted after it was assigned is still listed, by id', async () => {
        const gone = await Product.create({ category: P.msme.category, name: 'Old Loan', slug: 'old-loan', isActive: true });
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, gone)]);
        await Product.deleteOne({ _id: gone._id });
        const view = (await call('GET', '/v1/email-settings', { token: tokens.super })).body.data.config.settings.recipientProducts;
        assert.deepEqual(view[0].products, [{ _id: String(gone._id), name: '', isActive: false, category: '', exists: false }]);
    });
});

describe('delivery behaviour is unchanged', () => {
    test('one email per application: queueing again inserts and sends nothing', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        const r = await msme();
        assert.equal(r.status, 'sent');
        assert.equal(await notifications.queueForApplication({ _id: r.application, applicationNumber: r.applicationNumber }), null);
        await notifications.whenIdle();
        assert.equal(await LoanApplicationNotification.countDocuments({ application: r.application }), 1);
        assert.equal(ms.sends.length, 1);
    });

    test('a throttled send is retried to the same recipients and then sent', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        ms.send = [429];
        const r = await msme();
        assert.equal(r.status, 'retrying');
        assert.equal(r.outcomeCode, 'THROTTLED');
        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
        await notifications.sweep();
        await notifications.whenIdle();
        const retried = await LoanApplicationNotification.findById(r._id).lean();
        assert.equal(retried.status, 'sent');
        assert.equal(retried.attempts, 2);
        assert.deepEqual(retried.recipients, [PRIMARY, MSME_DESK]);
        assert.deepEqual(ms.sends.map((s) => s.to), [[PRIMARY, MSME_DESK], [PRIMARY, MSME_DESK]]);
    });

    test('the Email Delivery Log shows who each email went to', async () => {
        await saveRecipients([MSME_DESK], [assign(MSME_DESK, P.msme)]);
        const a = await msme();
        const b = await noProduct();
        const log = await call('GET', '/v1/email-settings/notifications?limit=100', { token: tokens.super });
        assert.equal(log.status, 200, log.text);
        const items = log.body.data.notifications || log.body.data.items || log.body.data.records;
        const byNumber = Object.fromEntries(items.map((n) => [n.applicationNumber, n]));
        assert.equal(byNumber[a.applicationNumber].status, 'sent');
        assert.equal(byNumber[b.applicationNumber].status, 'sent');
        const detail = await call('GET', `/v1/email-settings/notifications/${b._id}`, { token: tokens.super });
        assert.equal(detail.status, 200, detail.text);
        assert.ok(detail.text.includes(PRIMARY) && !detail.text.includes(MSME_DESK), 'the product-less application went to the primary recipient only');
    });
});
