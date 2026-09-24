// Advertisements: the CMS-only management API — end-to-end over HTTP against
// an in-memory MongoDB, with real JWTs for each role.
//
// The rule these tests exist for: at most one advertisement is Published, and
// the database itself refuses a second one.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-advertisement-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-advertisement-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const Admin = require('../src/models/Admin');
const Advertisement = require('../src/models/Advertisement');
const { generateAccessToken } = require('../src/utils/token');

let mongo;
let server;
let baseUrl;
const tokens = {};

const call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: json, text };
};

const BASE = '/v1/advertisements';
const create = (body = { name: 'Diwali offer', applyUrl: '/loan-application', applyButtonText: 'Apply' }, token = tokens.editor) =>
    call('POST', BASE, { token, body });
const publish = (id, token = tokens.editor) => call('PATCH', `${BASE}/${id}/publish`, { token });
const unpublish = (id, token = tokens.editor) => call('PATCH', `${BASE}/${id}/unpublish`, { token });

const published = () => Advertisement.find({ status: 'Published' }).lean();

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    // The unique index is what enforces the rule; build it as production would.
    await Advertisement.syncIndexes();

    const roles = { super: 'super_admin', editor: 'editor', content: 'content_manager' };
    for (const [key, role] of Object.entries(roles)) {
        const admin = await Admin.create({
            name: `Ad ${key}`, email: `ad-${key}@test.local`, password: 'Password@123', role, isActive: true
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
    await Advertisement.deleteMany({});
});

// ── Creation ──────────────────────────────────────────────────────────────────
describe('Creating an advertisement', () => {
    test('is created as a draft, with the given name, link and button text', async () => {
        const res = await create({ name: 'Diwali offer', applyUrl: '/loan-application', applyButtonText: 'Apply now' });
        assert.equal(res.status, 201, res.text);
        const ad = res.body.data.advertisement;
        assert.equal(ad.name, 'Diwali offer');
        assert.equal(ad.applyUrl, '/loan-application');
        assert.equal(ad.applyButtonText, 'Apply now');
        assert.equal(ad.status, 'Draft', 'a new advertisement never starts published');
        assert.equal(ad.publishedAt, null);
        assert.equal(ad.imageUrl, '', 'the image belongs to a later phase');
    });

    test('the button text defaults to Apply, and the image is left empty', async () => {
        const res = await create({ name: 'Minimal advertisement' });
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.advertisement.applyButtonText, 'Apply');
        assert.equal(res.body.data.advertisement.imageUrl, '');
        assert.equal(res.body.data.advertisement.applyUrl, '');
    });

    test('a status in the body is refused: publishing is its own action', async () => {
        const res = await create({ name: 'Sneaky', status: 'Published' });
        assert.equal(res.status, 400);
        assert.deepEqual(res.body.errors.map((e) => e.field), ['status']);
        assert.equal(await Advertisement.countDocuments(), 0);
    });
});

// ── Validation ────────────────────────────────────────────────────────────────
describe('Validation', () => {
    test('a missing or empty name is refused', async () => {
        for (const body of [{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(151) }]) {
            const res = await create(body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.ok(res.body.errors.some((e) => e.field === 'name'));
        }
        assert.equal(await Advertisement.countDocuments(), 0);
    });

    test('an apply link must be a page on this site or a full http(s) address', async () => {
        for (const applyUrl of ['javascript:alert(1)', 'data:text/html,<script>', 'mailto:a@b.c', '//evil.example', 'not a url']) {
            const res = await create({ name: 'Bad link', applyUrl });
            assert.equal(res.status, 400, applyUrl);
            assert.ok(res.body.errors.some((e) => e.field === 'applyUrl'));
        }
        for (const applyUrl of ['/loan-application', 'https://surjitfinance.com/apply', 'http://example.com/x']) {
            const res = await create({ name: `Good ${applyUrl}`, applyUrl });
            assert.equal(res.status, 201, applyUrl);
        }
    });

    test('over-long button text is refused', async () => {
        const res = await create({ name: 'Long button', applyButtonText: 'x'.repeat(41) });
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.some((e) => e.field === 'applyButtonText'));
    });

    test('a malformed id is refused rather than looked up', async () => {
        assert.equal((await call('GET', `${BASE}/not-an-id`, { token: tokens.editor })).status, 400);
        assert.equal((await publish('not-an-id')).status, 400);
        const missing = await call('GET', `${BASE}/${new mongoose.Types.ObjectId()}`, { token: tokens.editor });
        assert.equal(missing.status, 404);
    });
});

// ── Update ────────────────────────────────────────────────────────────────────
describe('Updating an advertisement', () => {
    test('a draft can be edited', async () => {
        const { body } = await create({ name: 'Before', applyUrl: '/a', applyButtonText: 'Apply' });
        const id = body.data.advertisement._id;
        const res = await call('PUT', `${BASE}/${id}`, {
            token: tokens.editor,
            body: { name: 'After', applyUrl: 'https://surjitfinance.com/loans', applyButtonText: 'Get a loan' }
        });
        assert.equal(res.status, 200, res.text);
        const ad = res.body.data.advertisement;
        assert.equal(ad.name, 'After');
        assert.equal(ad.applyUrl, 'https://surjitfinance.com/loans');
        assert.equal(ad.applyButtonText, 'Get a loan');
        assert.equal(ad.status, 'Draft');
    });

    test('a published advertisement can be edited and stays published', async () => {
        const { body } = await create({ name: 'Live', applyUrl: '/x' });
        const id = body.data.advertisement._id;
        await publish(id);
        const res = await call('PUT', `${BASE}/${id}`, { token: tokens.editor, body: { name: 'Live, edited' } });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement.name, 'Live, edited');
        assert.equal(res.body.data.advertisement.status, 'Published', 'editing does not take it off the site');
        assert.ok(res.body.data.advertisement.publishedAt);
        assert.equal((await published()).length, 1);
    });

    test('an update cannot change status or publishedAt', async () => {
        const { body } = await create({ name: 'Guarded' });
        const id = body.data.advertisement._id;
        for (const payload of [{ status: 'Published' }, { publishedAt: new Date().toISOString() }]) {
            const res = await call('PUT', `${BASE}/${id}`, { token: tokens.editor, body: { name: 'Guarded', ...payload } });
            assert.equal(res.status, 400, JSON.stringify(payload));
        }
        const ad = await Advertisement.findById(id).lean();
        assert.equal(ad.status, 'Draft');
        assert.equal(ad.publishedAt, null);
    });
});

// ── Publishing ────────────────────────────────────────────────────────────────
describe('Publishing', () => {
    test('publishing makes it live and stamps publishedAt', async () => {
        const { body } = await create({ name: 'First' });
        const id = body.data.advertisement._id;
        const res = await publish(id);
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement.status, 'Published');
        assert.ok(res.body.data.advertisement.publishedAt, 'publishedAt is set');
        assert.equal((await published()).length, 1);
    });

    test('publishing a second advertisement unpublishes the first', async () => {
        const a = (await create({ name: 'A' })).body.data.advertisement._id;
        const b = (await create({ name: 'B' })).body.data.advertisement._id;

        await publish(a);
        const res = await publish(b);
        assert.equal(res.status, 200, res.text);

        const live = await published();
        assert.equal(live.length, 1, 'exactly one advertisement is published');
        assert.equal(String(live[0]._id), b);

        const first = await Advertisement.findById(a).lean();
        assert.equal(first.status, 'Draft', 'the previous one steps down');
        assert.equal(first.publishedAt, null, 'and loses its published timestamp');
    });

    test('after publishing several in turn, only the last is live', async () => {
        const ids = [];
        for (const name of ['One', 'Two', 'Three', 'Four']) {
            ids.push((await create({ name })).body.data.advertisement._id);
        }
        for (const id of ids) {
            const res = await publish(id);
            assert.equal(res.status, 200, res.text);
            assert.equal((await published()).length, 1, 'never two at once');
        }
        const live = await published();
        assert.equal(String(live[0]._id), ids[ids.length - 1]);
        assert.equal(await Advertisement.countDocuments({ status: 'Draft' }), 3);
    });

    test('publishing the live advertisement again changes nothing', async () => {
        const id = (await create({ name: 'Idempotent' })).body.data.advertisement._id;
        const first = await publish(id);
        const again = await publish(id);
        assert.equal(again.status, 200);
        assert.equal(again.body.data.advertisement.publishedAt, first.body.data.advertisement.publishedAt);
        assert.equal((await published()).length, 1);
    });

    test('the database itself refuses a second published advertisement', async () => {
        const a = (await create({ name: 'A' })).body.data.advertisement._id;
        const b = (await create({ name: 'B' })).body.data.advertisement._id;
        await publish(a);

        // Bypassing the service entirely, as a racing request would.
        await assert.rejects(
            () => Advertisement.updateOne({ _id: b }, { $set: { status: 'Published', publishedAt: new Date() } }),
            (err) => err.code === 11000,
            'the unique partial index rejects it'
        );
        assert.equal((await published()).length, 1);
    });
});

// ── Unpublish ─────────────────────────────────────────────────────────────────
describe('Unpublishing', () => {
    test('a published advertisement can be taken off the site', async () => {
        const id = (await create({ name: 'Live' })).body.data.advertisement._id;
        await publish(id);
        const res = await unpublish(id);
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement.status, 'Draft');
        assert.equal(res.body.data.advertisement.publishedAt, null);
        assert.equal((await published()).length, 0, 'nothing is live afterwards');
    });

    test('unpublishing a draft is harmless', async () => {
        const id = (await create({ name: 'Draft' })).body.data.advertisement._id;
        const res = await unpublish(id);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.advertisement.status, 'Draft');
    });

    test('another advertisement can be published after one is unpublished', async () => {
        const a = (await create({ name: 'A' })).body.data.advertisement._id;
        const b = (await create({ name: 'B' })).body.data.advertisement._id;
        await publish(a);
        await unpublish(a);
        assert.equal((await publish(b)).status, 200);
        const live = await published();
        assert.equal(live.length, 1);
        assert.equal(String(live[0]._id), b);
    });
});

// ── Delete ────────────────────────────────────────────────────────────────────
describe('Deleting', () => {
    test('a draft can be deleted by a Super Admin', async () => {
        const id = (await create({ name: 'Disposable' })).body.data.advertisement._id;
        const res = await call('DELETE', `${BASE}/${id}`, { token: tokens.super });
        assert.equal(res.status, 200, res.text);
        assert.equal(await Advertisement.countDocuments({ _id: id }), 0);
    });

    test('a published advertisement must be unpublished first', async () => {
        const id = (await create({ name: 'Live' })).body.data.advertisement._id;
        await publish(id);
        const refused = await call('DELETE', `${BASE}/${id}`, { token: tokens.super });
        assert.equal(refused.status, 400);
        assert.match(refused.body.message, /Unpublish this advertisement before deleting it/);
        assert.equal(await Advertisement.countDocuments({ _id: id }), 1, 'still there');

        await unpublish(id);
        assert.equal((await call('DELETE', `${BASE}/${id}`, { token: tokens.super })).status, 200);
        assert.equal(await Advertisement.countDocuments(), 0);
    });
});

// ── Listing ───────────────────────────────────────────────────────────────────
describe('Listing', () => {
    test('newest first, with paging and a status filter', async () => {
        for (const name of ['Old', 'Middle', 'New']) await create({ name });
        const all = await call('GET', `${BASE}?page=1&limit=2`, { token: tokens.content });
        assert.equal(all.status, 200, all.text);
        assert.equal(all.body.data.total, 3);
        assert.equal(all.body.data.data.length, 2);
        assert.equal(all.body.data.data[0].name, 'New', 'newest first');

        const id = all.body.data.data[0]._id;
        await publish(id);
        const live = await call('GET', `${BASE}?status=Published`, { token: tokens.content });
        assert.equal(live.body.data.total, 1);
        assert.equal(live.body.data.data[0].name, 'New');

        const search = await call('GET', `${BASE}?search=Mid`, { token: tokens.content });
        assert.equal(search.body.data.total, 1);
        assert.equal(search.body.data.data[0].name, 'Middle');
    });
});

// ── Authorisation ─────────────────────────────────────────────────────────────
describe('Authorisation', () => {
    test('an unauthenticated request is rejected everywhere', async () => {
        const id = (await create({ name: 'Protected' })).body.data.advertisement._id;
        for (const [method, url] of [
            ['GET', BASE], ['GET', `${BASE}/${id}`], ['POST', BASE], ['PUT', `${BASE}/${id}`],
            ['PATCH', `${BASE}/${id}/publish`], ['PATCH', `${BASE}/${id}/unpublish`], ['DELETE', `${BASE}/${id}`]
        ]) {
            const res = await call(method, url, method === 'POST' || method === 'PUT' ? { body: { name: 'x' } } : {});
            assert.equal(res.status, 401, `${method} ${url}`);
        }
    });

    test('a Content Manager may read but not create, edit, publish or delete', async () => {
        const id = (await create({ name: 'Read only' })).body.data.advertisement._id;
        assert.equal((await call('GET', BASE, { token: tokens.content })).status, 200);
        assert.equal((await call('GET', `${BASE}/${id}`, { token: tokens.content })).status, 200);

        assert.equal((await create({ name: 'Nope' }, tokens.content)).status, 403);
        assert.equal((await call('PUT', `${BASE}/${id}`, { token: tokens.content, body: { name: 'Nope' } })).status, 403);
        assert.equal((await publish(id, tokens.content)).status, 403);
        assert.equal((await unpublish(id, tokens.content)).status, 403);
        assert.equal((await call('DELETE', `${BASE}/${id}`, { token: tokens.content })).status, 403);
    });

    test('an Editor may manage but not delete; a Super Admin may do everything', async () => {
        const id = (await create({ name: 'Editor made this' }, tokens.editor)).body.data.advertisement._id;
        assert.equal((await publish(id, tokens.editor)).status, 200);
        assert.equal((await unpublish(id, tokens.editor)).status, 200);
        assert.equal((await call('DELETE', `${BASE}/${id}`, { token: tokens.editor })).status, 403, 'deleting is Super Admin only');
        assert.equal((await call('DELETE', `${BASE}/${id}`, { token: tokens.super })).status, 200);
    });
});

// ── The management API stays closed ───────────────────────────────────────────
// Phase 4 opened exactly one public path — /public/advertisement, covered in
// its own suite below. Everything else about advertisements still needs a
// token.
describe('Nothing else is public', () => {
    test('only /public/advertisement is reachable without a token', async () => {
        const id = (await create({ name: 'Live' })).body.data.advertisement._id;
        await publish(id);
        for (const url of ['/public/advertisements', '/v1/public/advertisement', '/v1/public/ads']) {
            const res = await call('GET', url);
            assert.equal(res.status, 404, `${url} must not exist`);
        }
        // Anything under the management prefix is behind authentication, so a
        // guessed path returns "unauthorised" rather than advertisement data.
        const guessed = await call('GET', `${BASE}/public`);
        assert.equal(guessed.status, 401);
        assert.equal(guessed.body.data, undefined);
        // And the management routes stay closed without a token.
        assert.equal((await call('GET', BASE)).status, 401);
    });
});

// ── Phase 2: the advertisement image ──────────────────────────────────────────
// Uploads run through the CMS's own upload middleware. With no AWS bucket
// configured (as in this suite) it writes to the local uploads folder, which is
// exactly how a developer machine behaves; on the server the same middleware
// puts the object in S3 under the same prefix. Nothing here needs AWS
// credentials, and no real bucket is touched.
describe('Advertisement image upload', () => {
    const fs = require('fs');
    const path = require('path');
    const { PNG } = require('pngjs');
    const jpegJs = require('jpeg-js');

    const uploadsRoot = path.join(__dirname, '..', 'src', 'uploads');
    const adFolder = path.join(uploadsRoot, 'advertisements');
    const storedFiles = () => (fs.existsSync(adFolder) ? fs.readdirSync(adFolder) : []);

    const pixels = (w, h) => {
        const d = Buffer.alloc(w * h * 4);
        for (let i = 0; i < d.length; i += 4) { d[i] = 220; d[i + 1] = 180; d[i + 2] = 60; d[i + 3] = 255; }
        return d;
    };
    const PNG_BYTES = PNG.sync.write({ width: 80, height: 40, data: pixels(80, 40) });
    const JPEG_BYTES = Buffer.from(jpegJs.encode({ width: 80, height: 40, data: pixels(80, 40) }, 80).data);
    // A minimal but real RIFF/WEBP container.
    const WEBP_BYTES = Buffer.concat([
        Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(64, 1)
    ]);

    const form = ({ name = 'Personal Loan Offer', applyUrl = '/loan-application', applyButtonText = 'Apply',
        file, filename = 'canva-export.png', type = 'image/png', extra = {} } = {}) => {
        const fd = new FormData();
        if (name !== null) fd.append('name', name);
        if (applyUrl !== null) fd.append('applyUrl', applyUrl);
        if (applyButtonText !== null) fd.append('applyButtonText', applyButtonText);
        for (const [k, v] of Object.entries(extra)) fd.append(k, v);
        if (file) fd.append('image', new Blob([file], { type }), filename);
        return fd;
    };

    const send = async (method, url, fd, token = tokens.editor) => {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: fd });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-JSON */ }
        return { status: res.status, body: json, text };
    };

    const uploaded = [];
    const remember = (ad) => { if (ad && ad.imageFileName) uploaded.push(ad.imageFileName); return ad; };

    after(() => {
        for (const f of uploaded) {
            try { fs.unlinkSync(path.join(uploadsRoot, f)); } catch { /* already gone */ }
        }
    });

    for (const [label, bytes, filename, type] of [
        ['PNG', PNG_BYTES, 'offer.png', 'image/png'],
        ['JPEG', JPEG_BYTES, 'offer.jpg', 'image/jpeg'],
        ['WebP', WEBP_BYTES, 'offer.webp', 'image/webp']
    ]) {
        test(`an authorised admin can upload a ${label}`, async () => {
            const res = await send('POST', BASE, form({ name: `${label} advertisement`, file: bytes, filename, type }));
            assert.equal(res.status, 201, res.text);
            const ad = remember(res.body.data.advertisement);
            assert.ok(ad.imageUrl, 'the stored address is returned');
            assert.match(ad.imageUrl, /\/uploads\/advertisements\//, 'stored under the advertisements prefix');
            assert.ok(ad.imageFileName.startsWith('advertisements/'), 'and keyed under it too');
            assert.doesNotMatch(ad.imageFileName, /offer\./, 'the original filename is not the key');
            assert.equal(ad.status, 'Draft', 'uploading an image never publishes');
            assert.equal(ad.publishedAt, null);
            assert.ok(fs.existsSync(path.join(uploadsRoot, ad.imageFileName)), 'the file really exists');
        });
    }

    test('an advertisement can be created without an image', async () => {
        const res = await send('POST', BASE, form({ name: 'No artwork yet', file: null }));
        assert.equal(res.status, 201, res.text);
        assert.equal(res.body.data.advertisement.imageUrl, '');
        assert.equal(res.body.data.advertisement.imageFileName, '');
    });

    for (const [label, bytes, filename, type] of [
        ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'evil.svg', 'image/svg+xml'],
        ['GIF', Buffer.from('GIF89a'), 'anim.gif', 'image/gif'],
        ['PDF', Buffer.from('%PDF-1.4'), 'doc.pdf', 'application/pdf'],
        ['HTML', Buffer.from('<html><script>alert(1)</script></html>'), 'page.html', 'text/html'],
        ['JavaScript', Buffer.from('alert(1)'), 'script.js', 'application/javascript'],
        ['executable', Buffer.from('MZ'), 'setup.exe', 'application/x-msdownload']
    ]) {
        test(`${label} uploads are refused, and nothing is stored`, async () => {
            const before = storedFiles().length;
            const res = await send('POST', BASE, form({ name: `${label} attempt`, file: bytes, filename, type }));
            assert.equal(res.status, 400, res.text);
            assert.match(res.body.message, /must be PNG, JPG\/JPEG or WebP/);
            assert.equal(await Advertisement.countDocuments({ name: `${label} attempt` }), 0, 'no record');
            assert.equal(storedFiles().length, before, 'no file kept');
        });
    }

    test('a renamed file is refused: the extension and the type must agree', async () => {
        const mismatched = await send('POST', BASE, form({ name: 'Mismatch A', file: PNG_BYTES, filename: 'offer.png', type: 'application/pdf' }));
        assert.equal(mismatched.status, 400, mismatched.text);
        const renamed = await send('POST', BASE, form({ name: 'Mismatch B', file: Buffer.from('%PDF-1.4'), filename: 'doc.pdf', type: 'image/png' }));
        assert.equal(renamed.status, 400, renamed.text);
        assert.equal(await Advertisement.countDocuments({ name: /^Mismatch/ }), 0);
    });

    test('an image larger than 5 MB is refused', async () => {
        const before = storedFiles().length;
        const big = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * 1024 * 1024 + 1024, 7)]);
        const res = await send('POST', BASE, form({ name: 'Too large', file: big, filename: 'huge.png', type: 'image/png' }));
        assert.equal(res.status, 400, res.text);
        assert.match(res.body.message, /larger than 5 MB/);
        assert.equal(await Advertisement.countDocuments({ name: 'Too large' }), 0);
        assert.equal(storedFiles().length, before);
    });

    test('a file just under the limit is accepted', async () => {
        const nearLimit = Buffer.concat([PNG_BYTES, Buffer.alloc(4 * 1024 * 1024, 3)]);
        const res = await send('POST', BASE, form({ name: 'Just under', file: nearLimit, filename: 'big.png', type: 'image/png' }));
        assert.equal(res.status, 201, res.text);
        remember(res.body.data.advertisement);
    });

    test('the image can be replaced, and the previous file is removed afterwards', async () => {
        const created = await send('POST', BASE, form({ name: 'Replace me', file: PNG_BYTES }));
        const first = remember(created.body.data.advertisement);
        assert.ok(fs.existsSync(path.join(uploadsRoot, first.imageFileName)));

        const updated = await send('PUT', `${BASE}/${first._id}`, form({ name: 'Replace me', file: JPEG_BYTES, filename: 'new.jpg', type: 'image/jpeg' }));
        assert.equal(updated.status, 200, updated.text);
        const second = remember(updated.body.data.advertisement);

        assert.notEqual(second.imageFileName, first.imageFileName, 'a new object, not an overwrite');
        assert.ok(fs.existsSync(path.join(uploadsRoot, second.imageFileName)), 'the new file is there');
        assert.equal(fs.existsSync(path.join(uploadsRoot, first.imageFileName)), false, 'the old one is cleaned up');
        assert.equal(second.status, 'Draft');
    });

    test('an update without a file keeps the existing image', async () => {
        const created = await send('POST', BASE, form({ name: 'Keep image', file: PNG_BYTES }));
        const ad = remember(created.body.data.advertisement);
        const res = await send('PUT', `${BASE}/${ad._id}`, form({ name: 'Keep image, new name', file: null }));
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement.imageUrl, ad.imageUrl);
        assert.equal(res.body.data.advertisement.imageFileName, ad.imageFileName);
        assert.ok(fs.existsSync(path.join(uploadsRoot, ad.imageFileName)));
    });

    test('a refused update leaves the record and its image untouched, and keeps no new file', async () => {
        const created = await send('POST', BASE, form({ name: 'Untouched', file: PNG_BYTES }));
        const ad = remember(created.body.data.advertisement);
        const before = storedFiles().length;

        const res = await send('PUT', `${BASE}/${ad._id}`, form({ name: '', file: JPEG_BYTES, filename: 'new.jpg', type: 'image/jpeg' }));
        assert.equal(res.status, 400, res.text);

        const stored = await Advertisement.findById(ad._id).lean();
        assert.equal(stored.imageUrl, ad.imageUrl, 'still the original image');
        assert.equal(stored.name, 'Untouched');
        assert.ok(fs.existsSync(path.join(uploadsRoot, ad.imageFileName)));
        assert.equal(storedFiles().length, before, 'the refused upload was discarded');
    });

    test('a storage failure is reported and leaves no image on the record', async () => {
        const created = await send('POST', BASE, form({ name: 'Save fails', file: PNG_BYTES }));
        const ad = remember(created.body.data.advertisement);
        const before = storedFiles().length;

        const save = mongoose.Model.prototype.save;
        mongoose.Model.prototype.save = function failing() { throw new Error('database unavailable'); };
        let res;
        try {
            res = await send('PUT', `${BASE}/${ad._id}`, form({ name: 'Save fails', file: JPEG_BYTES, filename: 'x.jpg', type: 'image/jpeg' }));
        } finally {
            mongoose.Model.prototype.save = save;
        }

        assert.equal(res.status, 500, 'the failure is reported, never a silent success');
        const stored = await Advertisement.findById(ad._id).lean();
        assert.equal(stored.imageUrl, ad.imageUrl, 'no half-written address');
        assert.equal(storedFiles().length, before, 'and the new upload was discarded');
    });

    test('deleting an advertisement removes its image too', async () => {
        const created = await send('POST', BASE, form({ name: 'Delete with image', file: PNG_BYTES }));
        const ad = created.body.data.advertisement;
        assert.ok(fs.existsSync(path.join(uploadsRoot, ad.imageFileName)));
        assert.equal((await call('DELETE', `${BASE}/${ad._id}`, { token: tokens.super })).status, 200);
        assert.equal(fs.existsSync(path.join(uploadsRoot, ad.imageFileName)), false);
    });

    test('an image address cannot be set from the request instead of uploading', async () => {
        const res = await send('POST', BASE, form({
            name: 'External image', file: null,
            extra: { imageUrl: 'https://evil.example/tracker.png' }
        }));
        assert.equal(res.status, 400, res.text);
        assert.ok(res.body.errors.some((e) => e.field === 'imageUrl'));
        assert.equal(await Advertisement.countDocuments({ name: 'External image' }), 0);
    });

    test('the storage key and prefix cannot be chosen by the request', async () => {
        const res = await send('POST', BASE, form({
            name: 'Path games', file: PNG_BYTES, filename: 'aadhaar.png',
            extra: { folder: 'loan-documents', bucket: 'another-bucket', key: 'loan-documents/x.png', imageFileName: 'loan-documents/x.png' }
        }));
        assert.equal(res.status, 400, res.text);
        assert.ok(res.body.errors.some((e) => e.field === 'imageFileName'));

        const second = await send('POST', BASE, form({
            name: 'Path games 2', file: PNG_BYTES, filename: 'aadhaar.png',
            extra: { folder: 'loan-documents', bucket: 'another-bucket' }
        }));
        assert.equal(second.status, 201, second.text);
        const ad = remember(second.body.data.advertisement);
        assert.ok(ad.imageFileName.startsWith('advertisements/'), 'always this module own prefix');
        assert.doesNotMatch(ad.imageFileName, /\.\.|loan-documents|aadhaar/, 'no traversal, no other module');
        assert.doesNotMatch(ad.imageUrl, /another-bucket/);
    });

    // The bug this guards against: a client that means to attach a file but
    // sends JSON instead. It used to save the text fields and report success
    // with no artwork, which is indistinguishable from a working upload.
    test('an image sent as a JSON field is refused, not silently ignored', async () => {
        const created = await create({ name: 'JSON image' });
        const id = created.body.data.advertisement._id;

        // What axios produces from a FormData when the request goes out as
        // application/json: the File serialises to an empty object.
        const res = await call('PUT', `${BASE}/${id}`, {
            token: tokens.editor,
            body: { name: 'JSON image', applyUrl: '/loan-application', image: {} }
        });

        assert.equal(res.status, 400, res.text);
        assert.ok(res.body.errors.some((e) => e.field === 'image'), res.text);

        const stored = await Advertisement.findById(id).lean();
        assert.equal(stored.name, 'JSON image', 'the refused request changed nothing');
        assert.equal(stored.imageUrl, '');
    });

    test('the same guard applies when creating', async () => {
        const res = await call('POST', BASE, {
            token: tokens.editor,
            body: { name: 'Created with a JSON image', image: {} }
        });

        assert.equal(res.status, 400, res.text);
        assert.ok(res.body.errors.some((e) => e.field === 'image'));
        assert.equal(await Advertisement.countDocuments({ name: 'Created with a JSON image' }), 0);
    });

    test('a real multipart upload still reaches the record', async () => {
        // The counterpart to the two above: the same field name, sent properly.
        const res = await send('POST', BASE, form({ name: 'Multipart works', file: PNG_BYTES, filename: 'ad.png' }));
        assert.equal(res.status, 201, res.text);
        const ad = remember(res.body.data.advertisement);
        assert.ok(ad.imageUrl, 'an image address was stored');
        assert.ok(ad.imageFileName.startsWith('advertisements/'), ad.imageFileName);
        assert.equal(storedFiles().filter((f) => f.includes(ad.imageFileName.split('/').pop())).length, 1, 'the file is in storage');
    });

    test('uploading needs an authorised admin', async () => {
        const before = storedFiles().length;
        assert.equal((await send('POST', BASE, form({ file: PNG_BYTES }), null)).status, 401);
        assert.equal((await send('POST', BASE, form({ file: PNG_BYTES }), tokens.content)).status, 403);
        assert.equal(storedFiles().length, before, 'a refused caller stores nothing');
    });
});


// ── The public endpoint ───────────────────────────────────────────────────────
// What the website may read: one advertisement, only ever a published one,
// and only the handful of fields the popup will need.
describe('Public advertisement endpoint', () => {
    const PUBLIC = '/public/advertisement';
    const publicGet = () => call('GET', PUBLIC);

    // Built directly so a published advertisement can carry artwork without
    // going through an upload; the CMS routes are exercised elsewhere.
    const seed = (fields = {}) => Advertisement.create({
        name: 'Diwali offer',
        imageUrl: 'https://cdn.example.com/advertisements/diwali.png',
        imageFileName: 'advertisements/diwali-123.png',
        applyUrl: '/loan-application',
        applyButtonText: 'Apply now',
        status: 'Draft',
        publishedAt: null,
        ...fields
    });

    const livePublished = (fields = {}) => seed({ status: 'Published', publishedAt: new Date(), ...fields });

    test('returns the published advertisement', async () => {
        await livePublished();

        const res = await publicGet();
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.success, true);
        const ad = res.body.data.advertisement;
        assert.equal(ad.name, 'Diwali offer');
        assert.equal(ad.imageUrl, 'https://cdn.example.com/advertisements/diwali.png');
        assert.equal(ad.applyUrl, '/loan-application');
        assert.equal(ad.applyButtonText, 'Apply now');
        assert.match(ad.id, /^[a-f0-9]{24}$/);
    });

    test('nothing published, nothing returned', async () => {
        const res = await publicGet();
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement, null);
    });

    test('a draft is never returned, not even as the only advertisement', async () => {
        await seed({ name: 'Draft only' });

        const res = await publicGet();
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement, null, 'a draft is not a fallback');
    });

    test('with a draft and a published advertisement, only the published one is returned', async () => {
        // The draft is created last, so "newest first" would pick the wrong one.
        await livePublished({ name: 'Published B' });
        await seed({ name: 'Draft A' });

        const res = await publicGet();
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement.name, 'Published B');
    });

    test('unpublishing takes it off the public endpoint straight away', async () => {
        const ad = await livePublished();
        assert.ok((await publicGet()).body.data.advertisement);

        const res = await unpublish(String(ad._id));
        assert.equal(res.status, 200, res.text);
        assert.equal((await publicGet()).body.data.advertisement, null);
    });

    test('carries only the fields the popup needs, and nothing internal', async () => {
        await livePublished();

        const ad = (await publicGet()).body.data.advertisement;
        assert.deepEqual(
            Object.keys(ad).sort(),
            ['applyButtonText', 'applyUrl', 'id', 'imageUrl', 'name']
        );
        for (const field of ['imageFileName', 'publishedAt', 'createdAt', 'updatedAt', 'status', '_id', '__v']) {
            assert.equal(field in ad, false, field);
        }
    });

    test('the storage key and anything behind it never appear in the response', async () => {
        await livePublished({ imageFileName: 'advertisements/secret-object-key.png' });

        const res = await publicGet();
        assert.doesNotMatch(res.text, /secret-object-key/);
        assert.doesNotMatch(res.text, /imageFileName/);
        assert.doesNotMatch(res.text, /bucket/i);
    });

    test('a published advertisement without artwork is treated as nothing to show', async () => {
        const ad = await livePublished({ imageUrl: '' });

        const res = await publicGet();
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.advertisement, null, 'never a broken image');

        // A read changes nothing: the record is still published, still empty.
        const stored = await Advertisement.findById(ad._id).lean();
        assert.equal(stored.status, 'Published');
        assert.equal(stored.imageUrl, '');
    });

    test('an image URL of only whitespace counts as no artwork', async () => {
        await livePublished({ imageUrl: '   ' });
        assert.equal((await publicGet()).body.data.advertisement, null);
    });

    test('needs no admin token, and a token changes nothing', async () => {
        await livePublished();

        const anonymous = await publicGet();
        assert.equal(anonymous.status, 200);
        assert.ok(anonymous.body.data.advertisement);

        const withToken = await call('GET', PUBLIC, { token: tokens.super });
        assert.deepEqual(withToken.body.data.advertisement, anonymous.body.data.advertisement);
    });

    test('a rejected admin token does not keep a visitor out', async () => {
        await livePublished();
        const res = await call('GET', PUBLIC, { token: 'not.a.real.token' });
        assert.equal(res.status, 200, res.text);
        assert.ok(res.body.data.advertisement);
    });

    test('is read-only: no public route writes an advertisement', async () => {
        const ad = await livePublished();

        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const res = await call(method, PUBLIC, { body: { name: 'Injected', status: 'Published' } });
            assert.equal(res.status, 404, `${method} ${PUBLIC} -> ${res.status}`);
        }

        assert.equal(await Advertisement.countDocuments(), 1, 'nothing was created or removed');
        const stored = await Advertisement.findById(ad._id).lean();
        assert.equal(stored.name, 'Diwali offer', 'nothing was rewritten');
    });

    test('there is no public route that lists or reads advertisements by id', async () => {
        const ad = await livePublished();

        assert.equal((await call('GET', '/public/advertisements')).status, 404);
        assert.equal((await call('GET', `/public/advertisement/${ad._id}`)).status, 404);
    });

    test('the published advertisement is found through an index, not a collection scan', async () => {
        await livePublished();

        const plan = await Advertisement.find({ status: 'Published' })
            .select('name imageUrl applyUrl applyButtonText')
            .explain('queryPlanner');
        const winning = JSON.stringify(plan.queryPlanner.winningPlan);
        assert.match(winning, /IXSCAN/, winning);
    });
});
