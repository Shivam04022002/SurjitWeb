// Product Notification Rules: which products' new loan applications are
// emailed. Real submissions through the public route, a real (in-memory)
// MongoDB and the saved Email Settings; only Microsoft is replaced by a fake
// that counts sign-ins and sends. No real email is sent; fake applicants only.

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-product-rules-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-product-rules-suite';
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
const { productSelected } = require('../src/services/email/emailRules');

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
        ms.sends.push({ to: /^To: (.*)$/m.exec(mime)?.[1] || '' });
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
const products = {};

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

const configure = (overrides = {}) => emailConfig.save({
    provider: 'microsoft365', authMethod: 'graph', senderName: 'Surjit Finance', senderEmail: 'loans@surjitfinance.com',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47', clientId: '11111111-2222-3333-4444-555555555555',
    clientSecret: 'Qx8~ProductRules.Secret_Value-0123456789abcd',
    primaryRecipient: 'ops@surjitfinance.com', additionalRecipients: ['credit@surjitfinance.com'],
    notifyNewLoanApplication: true, ...overrides
}, null);

const setRules = (ids, token = tokens.super) => call('PUT', '/v1/email-settings/product-rules', { token, body: { productIds: ids.map(String) } });

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await roleService.ensureSystemRoles();
    await LoanApplicationNotification.init();
    await Role.create({ key: 'email_viewer', name: 'Email Viewer', permissions: ['integrations.view'] });
    for (const [k, role] of Object.entries({ super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'email_viewer' })) {
        const a = await Admin.create({ name: `Rules ${k}`, email: `rules-${k}@test.local`, password: 'Password@123', role, isActive: true });
        tokens[k] = generateAccessToken({ id: a._id, role });
    }
    const business = await ProductCategory.create({ name: 'Business Loan', slug: 'business-loan' });
    const vehicle = await ProductCategory.create({ name: 'Commercial Vehicle Loan', slug: 'commercial-vehicle-loan' });
    products.msme = await Product.create({ category: business._id, name: 'MSME Loan', slug: 'msme-loan', isActive: true });
    products.trade = await Product.create({ category: business._id, name: 'Trade Loan', slug: 'trade-loan', isActive: true });
    products.erick = await Product.create({ category: vehicle._id, name: 'E-Rickshaw Loan', slug: 'e-rickshaw-loan', isActive: true });
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
    await configure();
    await EmailSetting.updateOne({}, { $set: { notifyProductIds: [] } });
});

describe('which applications are emailed', () => {
    test('no products selected: every application is emailed, with or without a product, as before', async () => {
        const withProduct = await submit({ productId: products.msme._id });
        const without = await submit();
        const vehicle = await submit({ productId: products.erick._id, loanType: 'vehicle' });
        for (const r of [withProduct, without, vehicle]) assert.equal(r.status, 'sent');
        assert.equal(ms.sends.length, 3);
    });

    test('a selected product is emailed to the saved recipients through Microsoft 365', async () => {
        assert.equal((await setRules([products.msme._id])).status, 200);
        const r = await submit({ productId: products.msme._id });
        assert.equal(r.status, 'sent');
        assert.equal(r.outcomeCode, 'SENT');
        assert.deepEqual(r.recipients, ['ops@surjitfinance.com', 'credit@surjitfinance.com']);
        assert.equal(r.content.templateVersion, 'loan-application/v2');
        assert.match(r.content.subject, /MSME Loan/);
        assert.equal(ms.sends.length, 1);
        assert.match(ms.sends[0].to, /ops@surjitfinance\.com/);
    });

    test('a product that is not selected is not emailed, and the log says why', async () => {
        await setRules([products.msme._id]);
        const r = await submit({ productId: products.trade._id });
        assert.equal(r.status, 'skipped');
        assert.equal(r.outcomeCode, 'PRODUCT_NOT_SELECTED');
        assert.equal(ms.sends.length + ms.tokens, 0, 'Microsoft is not contacted');
    });

    test('several products: each selected one is emailed, the others and product-less applications are not', async () => {
        await setRules([products.msme._id, products.erick._id]);
        const results = {
            msme: await submit({ productId: products.msme._id }),
            erick: await submit({ productId: products.erick._id, loanType: 'vehicle' }),
            trade: await submit({ productId: products.trade._id }),
            none: await submit()
        };
        assert.deepEqual(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.outcomeCode])),
            { msme: 'SENT', erick: 'SENT', trade: 'PRODUCT_NOT_SELECTED', none: 'PRODUCT_NOT_SELECTED' });
        assert.equal(ms.sends.length, 2);
    });

    test('the product compared is the one the server saved, not anything else the browser sent', async () => {
        await setRules([products.msme._id]);
        // `product` and a product name are not accepted from the public form.
        const r = await submit({ product: String(products.msme._id), productName: 'MSME Loan' });
        assert.equal(r.outcomeCode, 'PRODUCT_NOT_SELECTED');
        assert.equal(ms.sends.length, 0);
    });

    test('turning loan emails off still wins over a matching product', async () => {
        await setRules([products.msme._id]);
        await configure({ notifyNewLoanApplication: false });
        assert.equal((await submit({ productId: products.msme._id })).outcomeCode, 'DISABLED');
    });

    test('the rule helper: empty is no filter; ids compare as text; populated products work', () => {
        assert.equal(productSelected([], null), true);
        assert.equal(productSelected(undefined, products.msme._id), true);
        assert.equal(productSelected([products.msme._id], String(products.msme._id)), true);
        assert.equal(productSelected([String(products.msme._id)], { _id: products.msme._id, name: 'x' }), true);
        assert.equal(productSelected([products.msme._id], products.trade._id), false);
        assert.equal(productSelected([products.msme._id], null), false);
    });
});

describe('saving the rules', () => {
    test('the rules are saved and reported with each product\'s name; empty clears the filter', async () => {
        const res = await setRules([products.erick._id, products.msme._id]);
        assert.equal(res.status, 200, res.text);
        const rules = res.body.data.config.productRules;
        assert.deepEqual(rules.productIds, [String(products.erick._id), String(products.msme._id)]);
        assert.deepEqual(rules.products.map((p) => [p.name, p.category, p.isActive, p.exists]),
            [['E-Rickshaw Loan', 'Commercial Vehicle Loan', true, true], ['MSME Loan', 'Business Loan', true, true]]);
        const read = await call('GET', '/v1/email-settings', { token: tokens.viewer });
        assert.deepEqual(read.body.data.config.productRules.productIds, rules.productIds);

        const cleared = await setRules([]);
        assert.equal(cleared.status, 200);
        assert.deepEqual(cleared.body.data.config.productRules, { productIds: [], products: [] });
    });

    test('invalid, unknown and repeated product ids are refused, and the saved rules are kept', async () => {
        await setRules([products.msme._id]);
        const unknown = new mongoose.Types.ObjectId();
        const cases = [
            [{ productIds: ['not-an-id'] }, /chosen from the product list/],
            [{ productIds: [String(unknown)] }, new RegExp(`do(es)? not exist: ${unknown}`)],
            [{ productIds: [String(products.msme._id), String(products.msme._id)] }, /more than once/],
            [{ productIds: String(products.msme._id) }, /must be a list/],
            [{ productIds: [{ $ne: null }] }, /chosen from the product list/],
            [{}, /productIds is required/]
        ];
        for (const [body, message] of cases) {
            const res = await call('PUT', '/v1/email-settings/product-rules', { token: tokens.super, body });
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.match(res.body.errors[0].message, message);
        }
        const saved = await EmailSetting.findOne({}).lean();
        assert.deepEqual(saved.notifyProductIds.map(String), [String(products.msme._id)]);
    });

    test('only staff with API Settings edit access can change the rules', async () => {
        const body = { productIds: [String(products.trade._id)] };
        assert.equal((await call('PUT', '/v1/email-settings/product-rules', { body })).status, 401);
        assert.equal((await call('PUT', '/v1/email-settings/product-rules', { token: 'forged.x.y', body })).status, 401);
        for (const who of ['content', 'editor', 'viewer']) {
            assert.equal((await call('PUT', '/v1/email-settings/product-rules', { token: tokens[who], body })).status, 403, who);
        }
        assert.equal((await call('GET', '/v1/email-settings', { token: tokens.content })).status, 403);
        assert.equal((await call('GET', '/v1/email-settings', { token: tokens.viewer })).status, 200);
        assert.deepEqual((await EmailSetting.findOne({}).lean()).notifyProductIds, []);
    });

    test('saving rules leaves recipients and credentials alone, sends nothing and queues nothing', async () => {
        const before = await EmailSetting.findOne({}).select('+encryptedClientSecret').lean();
        const queued = await LoanApplicationNotification.countDocuments();
        await setRules([products.msme._id]);
        await setRules([products.msme._id, products.trade._id]);
        await notifications.whenIdle();
        const afterSave = await EmailSetting.findOne({}).select('+encryptedClientSecret').lean();
        for (const k of ['primaryRecipient', 'additionalRecipients', 'notifyNewLoanApplication', 'senderEmail', 'tenantId', 'clientId', 'encryptedClientSecret', 'lastTest']) {
            assert.deepEqual(afterSave[k], before[k], k);
        }
        assert.equal(await LoanApplicationNotification.countDocuments(), queued);
        assert.equal(ms.sends.length + ms.tokens, 0);
    });

    test('saving recipients, or everything at once, keeps the product rules', async () => {
        await setRules([products.msme._id]);
        const r = await call('PUT', '/v1/email-settings/recipients', { token: tokens.super, body: { primaryRecipient: 'new@surjitfinance.com', additionalRecipients: [], notifyNewLoanApplication: true } });
        assert.equal(r.status, 200, r.text);
        await configure();
        assert.deepEqual((await EmailSetting.findOne({}).lean()).notifyProductIds.map(String), [String(products.msme._id)]);
    });

    test('a product deleted after it was selected is still listed, by id', async () => {
        const gone = await Product.create({ category: (await ProductCategory.findOne({ slug: 'business-loan' }))._id, name: 'Old Loan', slug: 'old-loan', isActive: true });
        await setRules([gone._id]);
        await Product.deleteOne({ _id: gone._id });
        const read = await call('GET', '/v1/email-settings', { token: tokens.super });
        assert.deepEqual(read.body.data.config.productRules.products, [{ _id: String(gone._id), name: '', isActive: false, category: '', exists: false }]);
    });
});

describe('delivery behaviour is unchanged for selected products', () => {
    test('one email per application: queueing again inserts and sends nothing', async () => {
        await setRules([products.msme._id]);
        const r = await submit({ productId: products.msme._id });
        assert.equal(r.status, 'sent');
        const application = { _id: r.application, applicationNumber: r.applicationNumber };
        assert.equal(await notifications.queueForApplication(application), null);
        await notifications.whenIdle();
        assert.equal(await LoanApplicationNotification.countDocuments({ application: r.application }), 1);
        assert.equal(ms.sends.length, 1);
    });

    test('a throttled send is retried and then sent; a skipped one is never retried', async () => {
        await setRules([products.msme._id]);
        ms.send = [429];
        const r = await submit({ productId: products.msme._id });
        assert.equal(r.status, 'retrying');
        assert.equal(r.outcomeCode, 'THROTTLED');
        await LoanApplicationNotification.updateOne({ _id: r._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
        const skipped = await submit({ productId: products.trade._id });
        await notifications.sweep();
        await notifications.whenIdle();
        const retried = await LoanApplicationNotification.findById(r._id).lean();
        assert.equal(retried.status, 'sent');
        assert.equal(retried.attempts, 2);
        assert.deepEqual(retried.events.map((e) => e.status), ['retrying', 'sent']);
        const still = await LoanApplicationNotification.findById(skipped._id).lean();
        assert.equal(still.status, 'skipped');
        assert.equal(still.attempts, 1);
    });

    test('the Email Delivery Log lists sent and product-skipped records', async () => {
        await setRules([products.msme._id]);
        const sent = await submit({ productId: products.msme._id });
        const skipped = await submit({ productId: products.trade._id });
        const log = await call('GET', '/v1/email-settings/notifications?limit=100', { token: tokens.super });
        assert.equal(log.status, 200, log.text);
        const items = log.body.data.notifications || log.body.data.items || log.body.data.records;
        const byNumber = Object.fromEntries(items.map((n) => [n.applicationNumber, n]));
        assert.equal(byNumber[sent.applicationNumber].status, 'sent');
        assert.equal(byNumber[skipped.applicationNumber].status, 'skipped');
        assert.equal(byNumber[skipped.applicationNumber].outcomeCode, 'PRODUCT_NOT_SELECTED');
    });
});
