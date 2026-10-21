// Product Features & Benefits: managed from the product editor in the CMS and
// rendered on the public product page — end-to-end over HTTP against an
// in-memory MongoDB, with real JWTs for each role.
//
// The features live embedded in each Product document, so the rules these
// tests exist for are: one product's list never touches another's, the order
// the CMS saves is the order the public API returns, and only an admin holding
// Products edit can change any of it.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-product-features-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-product-features-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Role = require('../src/models/Role');
const Product = require('../src/models/Product');
const ProductCategory = require('../src/models/ProductCategory');
const { generateAccessToken } = require('../src/utils/token');

let mongo;
let server;
let baseUrl;
const tokens = {};

const call = async (method, url, { token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) {
        // The CMS posts features as multipart (the icon rides along), so the
        // tests that stand in for it do too.
        payload = new FormData();
        for (const [k, v] of Object.entries(form)) payload.append(k, v);
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: json, text };
};

const ADMIN = '/v1/products';
const PUBLIC = '/public/products';

// The seven cards the E-Rickshaw Loan page carries in production, in order.
const ERICKSHAW_FEATURES = [
    'Upto 75% of Ex-Showroom Price Financed',
    'Competitive Interest Rates',
    'Flexible Repayment Tenure',
    'Loan for New and Used Vehicles',
    'Low Down Payment Options',
    'Insurance Coverage',
    'Easy Eligibility Criteria'
];

let category;
let erickshaw;
let msme;

const titles = (features) => features.map((f) => f.title);
const adminList = async (productId, token = tokens.editor) => {
    const res = await call('GET', `${ADMIN}/${productId}/features`, { token });
    assert.equal(res.status, 200, res.text);
    return res.body.data.features;
};
const publicList = async (productId) => {
    const res = await call('GET', `${PUBLIC}/${productId}/features`);
    assert.equal(res.status, 200, res.text);
    return res.body.data.features;
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());

    // A role that may look at products but not change them.
    await Role.create({ key: 'product_viewer', name: 'Product Viewer', permissions: ['products.view'], status: 'Active' });
    // Content Manager ships view-only; an administrator can grant it Products
    // edit on the Roles page. It is then still barred from changing ordering
    // through an edit, which is the case the CMS feature form has to respect.
    await Role.create({
        key: 'content_manager', name: 'Content Manager', isSystem: true,
        permissions: ['products.view', 'products.edit'], status: 'Active'
    });

    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager', viewer: 'product_viewer' };
    for (const [key, role] of Object.entries(roles)) {
        const admin = await Admin.create({
            name: `Pf ${key}`, email: `pf-${key}@test.local`, password: 'Password@123', role, isActive: true
        });
        tokens[key] = generateAccessToken({ id: admin._id, role });
    }

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server?.close();
    await mongoose.disconnect();
    await mongo?.stop();
});

beforeEach(async () => {
    await Product.deleteMany({});
    await ProductCategory.deleteMany({});
    category = await ProductCategory.create({ name: 'Commercial Vehicle Loan', slug: 'commercial-vehicle-loan' });
    // Shaped as the migration stored them: embedded, ordered 1..n.
    erickshaw = await Product.create({
        category: category._id, name: 'E-Rickshaw Loan', slug: 'commercial-vehicle-loan',
        features: ERICKSHAW_FEATURES.map((title, i) => ({ title, description: '', displayOrder: i + 1 }))
    });
    msme = await Product.create({ category: category._id, name: 'Unsecured MSME loan', slug: 'unsecured-msme-loan' });
});

// ── Existing data ─────────────────────────────────────────────────────────────
describe('Existing features', () => {
    test('E-Rickshaw Loan opens in the CMS with its seven features, in order', async () => {
        const features = await adminList(erickshaw._id);
        assert.deepEqual(titles(features), ERICKSHAW_FEATURES);
        assert.deepEqual(features.map((f) => f.displayOrder), [1, 2, 3, 4, 5, 6, 7]);
    });

    test('the public page gets the same seven, in the same order', async () => {
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
    });

    test('a product with no features returns an empty list, not an error', async () => {
        assert.deepEqual(await adminList(msme._id), []);
        assert.deepEqual(await publicList(msme._id), []);
        const page = await call('GET', `${PUBLIC}/by-slug/unsecured-msme-loan`);
        assert.equal(page.status, 200, page.text);
        assert.deepEqual(page.body.data.product.features, []);
    });
});

// ── Editing ───────────────────────────────────────────────────────────────────
describe('Editing a feature', () => {
    test('a changed title and description are saved and read back', async () => {
        const [first] = await adminList(erickshaw._id);
        const res = await call('PUT', `${ADMIN}/features/${first._id}`, {
            token: tokens.editor,
            form: { title: 'Upto 75% of E-Rickshaw Price Financed', description: 'On the on-road price.' }
        });
        assert.equal(res.status, 200, res.text);

        const after = await publicList(erickshaw._id);
        assert.equal(after[0].title, 'Upto 75% of E-Rickshaw Price Financed');
        assert.equal(after[0].description, 'On the on-road price.');
        assert.equal(after[0].displayOrder, 1, 'editing does not move the card');
        assert.equal(after.length, 7);
    });

    test('an empty description clears the stored one', async () => {
        const [first] = await adminList(erickshaw._id);
        await call('PUT', `${ADMIN}/features/${first._id}`, { token: tokens.editor, form: { title: first.title, description: 'temp' } });
        await call('PUT', `${ADMIN}/features/${first._id}`, { token: tokens.editor, form: { title: first.title, description: '' } });
        assert.equal((await publicList(erickshaw._id))[0].description, '');
    });

    test('a Content Manager can edit a feature as the CMS sends it (no displayOrder)', async () => {
        const [, second] = await adminList(erickshaw._id);
        const res = await call('PUT', `${ADMIN}/features/${second._id}`, {
            token: tokens.content, form: { title: 'Lowest Interest Rates', description: '' }
        });
        assert.equal(res.status, 200, res.text);
        assert.equal((await publicList(erickshaw._id))[1].title, 'Lowest Interest Rates');
    });

    test('a Content Manager still cannot move a card through the edit route', async () => {
        const [first] = await adminList(erickshaw._id);
        const res = await call('PUT', `${ADMIN}/features/${first._id}`, {
            token: tokens.content, form: { title: first.title, displayOrder: '9' }
        });
        assert.equal(res.status, 403, res.text);
    });

    test('an empty or over-long title is refused', async () => {
        const [first] = await adminList(erickshaw._id);
        for (const title of ['', '   ', 'x'.repeat(201)]) {
            const res = await call('PUT', `${ADMIN}/features/${first._id}`, { token: tokens.editor, form: { title } });
            assert.equal(res.status, 400, JSON.stringify(title));
        }
        assert.equal((await publicList(erickshaw._id))[0].title, ERICKSHAW_FEATURES[0]);
    });
});

// ── Adding and deleting ───────────────────────────────────────────────────────
describe('Adding and deleting', () => {
    test('a new feature is added at the end of the list', async () => {
        const res = await call('POST', `${ADMIN}/${erickshaw._id}/features`, {
            token: tokens.editor, form: { title: 'Doorstep Service', description: 'We come to you.' }
        });
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.feature.displayOrder, 8);

        const after = await publicList(erickshaw._id);
        assert.deepEqual(titles(after), [...ERICKSHAW_FEATURES, 'Doorstep Service']);
        assert.equal(after[7].description, 'We come to you.');
    });

    test('the first feature on an empty product gets position 1', async () => {
        const res = await call('POST', `${ADMIN}/${msme._id}/features`, { token: tokens.editor, form: { title: 'Collateral Free' } });
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.feature.displayOrder, 1);
    });

    test('a feature without a title is refused and nothing is stored', async () => {
        const res = await call('POST', `${ADMIN}/${erickshaw._id}/features`, { token: tokens.editor, form: { description: 'no title' } });
        assert.equal(res.status, 400, res.text);
        assert.equal((await publicList(erickshaw._id)).length, 7);
    });

    test('a deleted feature disappears from the public list; the rest keep their order', async () => {
        const features = await adminList(erickshaw._id);
        const res = await call('DELETE', `${ADMIN}/features/${features[5]._id}`, { token: tokens.editor });
        assert.equal(res.status, 200, res.text);
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES.filter((t) => t !== 'Insurance Coverage'));
    });
});

// ── Reordering ────────────────────────────────────────────────────────────────
describe('Reordering', () => {
    test('the saved order is the order the public API returns', async () => {
        const features = await adminList(erickshaw._id);
        const reversed = [...features].reverse();
        const res = await call('PATCH', `${ADMIN}/features/reorder`, {
            token: tokens.editor, body: { productId: String(erickshaw._id), ids: reversed.map((f) => f._id) }
        });
        assert.equal(res.status, 200, res.text);
        assert.deepEqual(titles(res.body.data.features), [...ERICKSHAW_FEATURES].reverse());
        assert.deepEqual(titles(await publicList(erickshaw._id)), [...ERICKSHAW_FEATURES].reverse());
    });

    test('moving one card down a place (as the CMS arrows do) swaps it with its neighbour', async () => {
        const features = await adminList(erickshaw._id);
        const ids = features.map((f) => f._id);
        [ids[0], ids[1]] = [ids[1], ids[0]];
        await call('PATCH', `${ADMIN}/features/reorder`, { token: tokens.editor, body: { productId: String(erickshaw._id), ids } });
        const after = titles(await publicList(erickshaw._id));
        assert.deepEqual(after.slice(0, 2), [ERICKSHAW_FEATURES[1], ERICKSHAW_FEATURES[0]]);
        assert.deepEqual(after.slice(2), ERICKSHAW_FEATURES.slice(2));
    });

    test("another product's feature id is refused and nothing moves", async () => {
        const added = await call('POST', `${ADMIN}/${msme._id}/features`, { token: tokens.editor, form: { title: 'Collateral Free' } });
        const ids = (await adminList(erickshaw._id)).map((f) => f._id).reverse();
        const res = await call('PATCH', `${ADMIN}/features/reorder`, {
            token: tokens.editor, body: { productId: String(erickshaw._id), ids: [added.body.data.feature._id, ...ids] }
        });
        assert.equal(res.status, 400, res.text);
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
    });
});

// ── Independence ──────────────────────────────────────────────────────────────
describe('Each product keeps its own list', () => {
    test('changes to MSME features leave E-Rickshaw untouched, and the reverse', async () => {
        await call('POST', `${ADMIN}/${msme._id}/features`, { token: tokens.editor, form: { title: 'Collateral Free' } });
        await call('POST', `${ADMIN}/${msme._id}/features`, { token: tokens.editor, form: { title: 'Quick Disbursal' } });
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
        assert.deepEqual(titles(await publicList(msme._id)), ['Collateral Free', 'Quick Disbursal']);

        const [first] = await adminList(erickshaw._id);
        await call('DELETE', `${ADMIN}/features/${first._id}`, { token: tokens.editor });
        assert.deepEqual(titles(await publicList(msme._id)), ['Collateral Free', 'Quick Disbursal']);
    });

    test('a newly created product starts empty and takes its own features', async () => {
        const created = await call('POST', ADMIN, {
            token: tokens.editor, form: { category: String(category._id), name: 'Gold Loan', slug: 'gold-loan' }
        });
        assert.equal(created.status, 201, created.text);
        const id = created.body.data.product._id;
        assert.deepEqual(await adminList(id), []);

        for (const title of ['Instant Approval', 'Low Rates']) {
            const res = await call('POST', `${ADMIN}/${id}/features`, { token: tokens.editor, form: { title } });
            assert.equal(res.status, 201, res.text);
        }
        assert.deepEqual(titles(await publicList(id)), ['Instant Approval', 'Low Rates']);
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
    });
});

// ── Authorization ─────────────────────────────────────────────────────────────
describe('Only admins with Products edit can change features', () => {
    test('without a token every write is refused', async () => {
        const [first] = await adminList(erickshaw._id);
        const attempts = [
            call('POST', `${ADMIN}/${erickshaw._id}/features`, { form: { title: 'x' } }),
            call('PUT', `${ADMIN}/features/${first._id}`, { form: { title: 'x' } }),
            call('DELETE', `${ADMIN}/features/${first._id}`),
            call('PATCH', `${ADMIN}/features/reorder`, { body: { productId: String(erickshaw._id), ids: [first._id] } })
        ];
        for (const res of await Promise.all(attempts)) assert.equal(res.status, 401, res.text);
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
    });

    test('a view-only role can read the list but every write is forbidden', async () => {
        const features = await adminList(erickshaw._id, tokens.viewer);
        const first = features[0];
        const attempts = [
            call('POST', `${ADMIN}/${erickshaw._id}/features`, { token: tokens.viewer, form: { title: 'x' } }),
            call('PUT', `${ADMIN}/features/${first._id}`, { token: tokens.viewer, form: { title: 'x' } }),
            call('DELETE', `${ADMIN}/features/${first._id}`, { token: tokens.viewer }),
            call('PATCH', `${ADMIN}/features/reorder`, { token: tokens.viewer, body: { productId: String(erickshaw._id), ids: [first._id] } })
        ];
        for (const res of await Promise.all(attempts)) assert.equal(res.status, 403, res.text);
        assert.deepEqual(titles(await publicList(erickshaw._id)), ERICKSHAW_FEATURES);
    });

    test('the public API has no write routes for features', async () => {
        const [first] = await adminList(erickshaw._id);
        const res = await call('PUT', `/public/products/features/${first._id}`, { body: { title: 'x' } });
        assert.ok([404, 405].includes(res.status), res.text);
    });
});

// ── Other sections ────────────────────────────────────────────────────────────
describe('Other product data', () => {
    test('editing features leaves the rest of the product as it was', async () => {
        await Product.updateOne({ _id: erickshaw._id }, {
            heroDescription: 'Hero copy', eligibility: [{ title: 'Nationality', description: 'Indian' }],
            faqs: [{ question: 'Q?', answer: 'A.' }], emiConfig: { interestRate: 16.5 }
        });
        const [first] = await adminList(erickshaw._id);
        await call('PUT', `${ADMIN}/features/${first._id}`, { token: tokens.editor, form: { title: 'Changed', description: '' } });
        await call('POST', `${ADMIN}/${erickshaw._id}/features`, { token: tokens.editor, form: { title: 'Added' } });

        const page = await call('GET', `${PUBLIC}/by-slug/commercial-vehicle-loan`);
        const p = page.body.data.product;
        assert.equal(p.heroDescription, 'Hero copy');
        assert.equal(p.eligibility[0].title, 'Nationality');
        assert.equal(p.faqs[0].question, 'Q?');
        assert.equal(p.emiConfig.interestRate, 16.5);
        assert.equal(p.features.length, 8);
    });
});
