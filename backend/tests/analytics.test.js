// Website analytics: the anonymous beacons, the city lookup and the admin
// overview — end-to-end over HTTP against an in-memory MongoDB.
//
// Nothing here touches a real GeoLite2 file or the network: the reader is a
// fake, so every lookup outcome (hit, miss, error, no database) is exercised.
//
//   npm test

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-analytics-suite';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-analytics-suite';
process.env.CORS_ORIGIN = 'https://surjitfinance.com';
process.env.AWS_S3_BUCKET_NAME = '';
process.env.GEOIP_CITY_DB_PATH = '';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const env = require('../src/config/env');
const Admin = require('../src/models/Admin');
const WebsiteVisit = require('../src/models/WebsiteVisit');
const WebsiteEvent = require('../src/models/WebsiteEvent');
const geoip = require('../src/services/geoip.service');
const { generateAccessToken } = require('../src/utils/token');

// ── Output capture: proves no address ever reaches a log line ─────────────────
const captured = [];
for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level];
    console[level] = (...args) => {
        captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        if (process.env.TEST_VERBOSE) original(...args);
    };
}

// ── Fake GeoLite2 reader ──────────────────────────────────────────────────────
const place = (city, region, country) => ({
    city: { names: { en: city } },
    subdivisions: [{ names: { en: region } }],
    country: { names: { en: country }, iso_code: 'IN' }
});
const RECORDS = {
    '49.36.1.10': place('Lucknow', 'Uttar Pradesh', 'India'),
    '103.21.58.7': place('Delhi', 'Delhi', 'India'),
    '2401:4900:1c80::5': place('Mumbai', 'Maharashtra', 'India'),
    // A country-only answer: no city in the database for this address.
    '8.8.8.8': { country: { names: { en: 'United States' }, iso_code: 'US' } }
};
const reader = { mode: 'ok', lookups: [] };
const fakeReader = {
    get: (ip) => {
        reader.lookups.push(ip);
        if (reader.mode === 'throw') throw new Error('corrupt database node');
        return RECORDS[ip] || null;
    }
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────
let mongo;
let server;
let baseUrl;
let token;
const responses = [];

const call = async (method, url, { body, ip, token: t } = {}) => {
    const headers = {};
    if (t) headers.Authorization = `Bearer ${t}`;
    // The request really comes from 127.0.0.1; with `trust proxy = 1` Express
    // takes the address the (single) trusted proxy appended.
    if (ip) headers['X-Forwarded-For'] = ip;
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}/api${url}`, { method, headers, body: payload });
    const text = await res.text();
    responses.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, body: json, text };
};

let sessionSeq = 0;
const sessionId = () => `sess${(sessionSeq += 1).toString().padStart(6, '0')}`;

const track = (ip, { session = sessionId(), path = '/loans' } = {}) =>
    call('POST', '/public/analytics/track', { ip, body: { sessionId: session, path } });

const overview = (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call('GET', `/v1/analytics/overview${q ? `?${q}` : ''}`, { token });
};

// Visits written straight to the collection, for aggregation tests.
const seedVisit = (fields) => WebsiteVisit.create({
    sessionId: fields.sessionId || sessionId(),
    path: fields.path || '/',
    referrer: fields.referrer || '',
    deviceType: fields.deviceType || 'desktop',
    country: fields.country ?? null,
    region: fields.region ?? null,
    city: fields.city ?? null,
    sessionStartedAt: fields.at || new Date(),
    viewedAt: fields.at || new Date()
});

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    const admin = await Admin.create({
        name: 'Analytics Admin', email: 'analytics@test.local', password: 'Password@123', role: 'super_admin', isActive: true
    });
    token = generateAccessToken({ id: admin._id, role: 'super_admin' });
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
    await WebsiteVisit.deleteMany({});
    await WebsiteEvent.deleteMany({});
    reader.mode = 'ok';
    reader.lookups = [];
    env.GEOIP_CITY_DB_PATH = '/test/GeoLite2-City.mmdb';
    geoip._setReader(fakeReader);
});

// ── Address handling ──────────────────────────────────────────────────────────
describe('Client address handling', () => {
    test('a public IPv4 address is used for the lookup', () => {
        assert.equal(geoip.publicIp('49.36.1.10'), '49.36.1.10');
    });

    test('a public IPv6 address is used for the lookup', () => {
        assert.equal(geoip.publicIp('2401:4900:1c80::5'), '2401:4900:1c80::5');
    });

    test('an IPv6-mapped IPv4 address is normalised', () => {
        assert.equal(geoip.publicIp('::ffff:49.36.1.10'), '49.36.1.10');
        assert.equal(geoip.publicIp('::FFFF:103.21.58.7'), '103.21.58.7');
    });

    test('private and reserved addresses are not placed', () => {
        for (const ip of ['10.0.0.5', '172.16.4.9', '172.31.255.1', '192.168.1.9', '169.254.10.1',
            '100.64.0.1', '0.0.0.0', '224.0.0.1', 'fd00::1', 'fe80::1%eth0', '::']) {
            assert.equal(geoip.publicIp(ip), null, ip);
        }
    });

    test('loopback addresses are not placed', () => {
        for (const ip of ['127.0.0.1', '127.9.9.9', '::1', '::ffff:127.0.0.1']) {
            assert.equal(geoip.publicIp(ip), null, ip);
        }
    });

    test('malformed or missing addresses are not placed', () => {
        for (const ip of ['', '   ', 'not-an-ip', '999.1.1.1', '1.2.3', '1.2.3.4.5', '<script>', null, undefined, 42, {}]) {
            assert.equal(geoip.publicIp(ip), null, String(ip));
        }
    });

    test('a spoofed forwarded-for header cannot set the address', async () => {
        // Two hops claimed, one trusted proxy: Express keeps what the proxy
        // appended (the real client), not the value the client invented.
        const res = await call('POST', '/public/analytics/track', {
            ip: '203.0.113.9, 49.36.1.10',
            body: { sessionId: sessionId(), path: '/loans' }
        });
        assert.equal(res.status, 201);
        assert.deepEqual(reader.lookups, ['49.36.1.10'], 'the client-supplied first hop is ignored');
        const visit = await WebsiteVisit.findOne().lean();
        assert.equal(visit.city, 'Lucknow');
    });
});

// ── Lookup outcomes ───────────────────────────────────────────────────────────
describe('City lookup', () => {
    test('a resolved address stores city, region and country', async () => {
        const res = await track('49.36.1.10');
        assert.equal(res.status, 201);
        const visit = await WebsiteVisit.findOne().lean();
        assert.deepEqual(
            { city: visit.city, region: visit.region, country: visit.country },
            { city: 'Lucknow', region: 'Uttar Pradesh', country: 'India' }
        );
    });

    test('an IPv6 visitor is placed too', async () => {
        await track('2401:4900:1c80::5');
        const visit = await WebsiteVisit.findOne().lean();
        assert.equal(visit.city, 'Mumbai');
        assert.equal(visit.country, 'India');
    });

    test('a country-only answer keeps the country and leaves the city empty', async () => {
        await track('8.8.8.8');
        const visit = await WebsiteVisit.findOne().lean();
        assert.equal(visit.country, 'United States');
        assert.equal(visit.city, null);
    });

    test('an address with no record is recorded without a location', async () => {
        await track('198.51.100.7');
        const visit = await WebsiteVisit.findOne().lean();
        assert.deepEqual([visit.city, visit.region, visit.country], [null, null, null]);
    });

    test('a private address is never looked up, and the visit is still recorded', async () => {
        const res = await track('192.168.1.40');
        assert.equal(res.status, 201);
        assert.equal(reader.lookups.length, 0, 'no lookup for a private address');
        assert.equal(await WebsiteVisit.countDocuments(), 1);
        const visit = await WebsiteVisit.findOne().lean();
        assert.equal(visit.city, null);
    });

    test('with no database configured the visit is still recorded', async () => {
        env.GEOIP_CITY_DB_PATH = '';
        geoip._reset();
        const res = await track('49.36.1.10');
        assert.equal(res.status, 201);
        assert.equal(await WebsiteVisit.countDocuments(), 1);
        assert.equal((await WebsiteVisit.findOne().lean()).city, null);
        assert.deepEqual(await geoip.status(), { available: false, reason: 'GEOIP_CITY_DB_PATH is not set' });
    });

    test('a missing database file is reported once and never breaks tracking', async () => {
        env.GEOIP_CITY_DB_PATH = '/does/not/exist/GeoLite2-City.mmdb';
        geoip._reset();
        assert.equal(await geoip.locate('49.36.1.10'), null);
        const status = await geoip.status();
        assert.equal(status.available, false);
        assert.match(status.reason, /database file was not found/);
        const res = await track('49.36.1.10');
        assert.equal(res.status, 201);
        assert.equal(await WebsiteVisit.countDocuments(), 1);
    });

    test('a lookup that throws is swallowed; the visit is recorded without a location', async () => {
        reader.mode = 'throw';
        const res = await track('49.36.1.10');
        assert.equal(res.status, 201);
        const visit = await WebsiteVisit.findOne().lean();
        assert.equal(visit.city, null);
        assert.ok(captured.some((l) => l.includes('GeoIP lookup failed')), 'the failure is noted');
    });
});

// ── Privacy ───────────────────────────────────────────────────────────────────
describe('Visitor privacy', () => {
    const ADDRESSES = ['49.36.1.10', '103.21.58.7', '2401:4900:1c80::5', '8.8.8.8', '198.51.100.7', '192.168.1.40'];

    test('no address is stored on the visit, in any form', async () => {
        for (const ip of ADDRESSES) await track(ip);
        const raw = await mongoose.connection.db.collection('websitevisits').find({}).toArray();
        assert.equal(raw.length, ADDRESSES.length);
        const allowed = ['_id', 'sessionId', 'path', 'referrer', 'deviceType', 'country', 'region', 'city', 'sessionStartedAt', 'viewedAt', '__v'];
        for (const doc of raw) {
            assert.deepEqual(Object.keys(doc).filter((k) => !allowed.includes(k)), [], 'no extra fields');
            const json = JSON.stringify(doc);
            for (const ip of ADDRESSES) assert.ok(!json.includes(ip), `${ip} must not be stored`);
            // Not a hash of one either: nothing here is derived from the address.
            assert.equal(doc.visitorHash, undefined);
            assert.equal(doc.ip, undefined);
        }
    });

    test('no address reaches an application log line or an API response', async () => {
        for (const ip of ADDRESSES) await track(ip);
        reader.mode = 'throw';
        await track('49.36.1.10');
        await overview({ range: '7d' });
        // Morgan's HTTP access log records the client address for every
        // request, as web server logs have always done here; that is separate
        // from analytics and predates this feature. Nothing analytics writes —
        // the lookup, the failure warning, the recorded visit — may contain an
        // address.
        const accessLog = /"(GET|POST|PUT|PATCH|DELETE) [^"]*" \d{3} /;
        const appLines = captured.filter((l) => !accessLog.test(l));
        assert.ok(appLines.length > 0);
        for (const line of appLines) {
            for (const ip of ADDRESSES) assert.ok(!line.includes(ip), `logged: ${line.slice(0, 160)}`);
        }
        for (const text of responses) {
            for (const ip of ADDRESSES) assert.ok(!text.includes(ip), `returned: ${text.slice(0, 160)}`);
        }
        assert.ok(captured.length > 0 && responses.length > 0);
    });
});

// ── Traffic by City ───────────────────────────────────────────────────────────
describe('Traffic by City', () => {
    test('counts visitors per city as distinct sessions, biggest first', async () => {
        const s = sessionId();
        await seedVisit({ sessionId: s, city: 'Lucknow' });
        await seedVisit({ sessionId: s, city: 'Lucknow', path: '/about' });   // same session, same visitor
        await seedVisit({ city: 'Lucknow' });
        await seedVisit({ city: 'Delhi' });
        await seedVisit({ city: 'Delhi' });
        await seedVisit({ city: 'Delhi' });
        await seedVisit({ city: 'Mumbai' });

        const { location, kpis } = (await overview({ range: '7d' })).body.data;
        assert.equal(location.available, true);
        assert.deepEqual(location.cities, [
            { city: 'Delhi', visitors: 3 },
            { city: 'Lucknow', visitors: 2 },
            { city: 'Mumbai', visitors: 1 }
        ]);
        assert.equal(location.knownVisitors, 6);
        assert.equal(location.unknownVisitors, 0);
        assert.equal(location.visitors, kpis.visitors, 'the same visitor definition as everywhere else');
        assert.equal(kpis.pageViews, 7);
    });

    test('visits without a location are counted as unknown, never guessed', async () => {
        await seedVisit({ city: 'Lucknow' });
        await seedVisit({});                       // historical: no location fields at all
        await seedVisit({ city: null });
        await seedVisit({ city: '' });
        const { location } = (await overview({ range: '7d' })).body.data;
        assert.deepEqual(location.cities, [{ city: 'Lucknow', visitors: 1 }]);
        assert.equal(location.knownVisitors, 1);
        assert.equal(location.unknownVisitors, 3);
        assert.equal(location.visitors, 4);
    });

    test('only visits inside the selected range are counted', async () => {
        await seedVisit({ city: 'Lucknow', at: new Date() });
        await seedVisit({ city: 'Delhi', at: daysAgo(3) });
        await seedVisit({ city: 'Mumbai', at: daysAgo(20) });

        const week = (await overview({ range: '7d' })).body.data.location;
        assert.deepEqual(week.cities.map((c) => c.city).sort(), ['Delhi', 'Lucknow']);
        const month = (await overview({ range: '30d' })).body.data.location;
        assert.deepEqual(month.cities.map((c) => c.city).sort(), ['Delhi', 'Lucknow', 'Mumbai']);
        const today = (await overview({ range: 'today' })).body.data.location;
        assert.deepEqual(today.cities.map((c) => c.city), ['Lucknow']);
    });

    test('no location data: an honest empty state, and whether lookup is set up', async () => {
        await seedVisit({});
        await seedVisit({});
        const { location } = (await overview({ range: '7d' })).body.data;
        assert.equal(location.available, false);
        assert.deepEqual(location.cities, []);
        assert.equal(location.knownVisitors, 0);
        assert.equal(location.unknownVisitors, 2);
        assert.equal(location.enabled, true, 'a database is configured, there is just no data yet');

        env.GEOIP_CITY_DB_PATH = '';
        geoip._reset();
        assert.equal((await overview({ range: '7d' })).body.data.location.enabled, false);
    });

    test('the city list is capped, with the total reported', async () => {
        for (let i = 0; i < 12; i++) {
            for (let v = 0; v <= i; v++) await seedVisit({ city: `City ${String(i).padStart(2, '0')}` });
        }
        const { location } = (await overview({ range: '7d' })).body.data;
        assert.equal(location.cities.length, 10);
        assert.equal(location.totalCities, 12);
        assert.equal(location.cities[0].city, 'City 11');
    });

    test('city analytics need the same sign-in as the rest of the dashboard', async () => {
        assert.equal((await call('GET', '/v1/analytics/overview')).status, 401);
    });
});

// ── Everything that was already there ─────────────────────────────────────────
describe('Existing analytics are unchanged', () => {
    test('visitors, page views, devices, sources and top pages still add up', async () => {
        const s1 = sessionId();
        await seedVisit({ sessionId: s1, path: '/', deviceType: 'mobile', referrer: 'www.google.com', city: 'Lucknow' });
        await seedVisit({ sessionId: s1, path: '/loans', deviceType: 'mobile', referrer: 'www.google.com', city: 'Lucknow' });
        await seedVisit({ sessionId: sessionId(), path: '/', deviceType: 'desktop', referrer: '' });
        await seedVisit({ sessionId: sessionId(), path: '/contact', deviceType: 'tablet', referrer: 'm.facebook.com' });

        const data = (await overview({ range: '7d' })).body.data;
        assert.equal(data.kpis.visitors, 3);
        assert.equal(data.kpis.pageViews, 4);
        assert.deepEqual(
            data.devices.map((d) => [d.key, d.visitors]).filter(([, v]) => v),
            [['desktop', 1], ['mobile', 1], ['tablet', 1]]
        );
        assert.deepEqual(
            Object.fromEntries(data.sources.map((s) => [s.key, s.visitors])),
            { direct: 1, search: 1, social: 1, referral: 0 }
        );
        assert.deepEqual(data.topPages.rows.map((r) => [r.path, r.pageViews]), [['/', 2], ['/contact', 1], ['/loans', 1]]);
        assert.equal(data.recentActivity.length, 4);
    });

    test('a page view is recorded with the same fields as before, plus the location', async () => {
        const session = sessionId();
        const res = await call('POST', '/public/analytics/track', {
            ip: '103.21.58.7',
            body: { sessionId: session, path: '/loans/business', referrer: 'https://www.google.com/search?q=loan', sessionStartedAt: new Date().toISOString() }
        });
        assert.equal(res.status, 201);
        const visit = await WebsiteVisit.findOne({ sessionId: session }).lean();
        assert.equal(visit.path, '/loans/business');
        assert.equal(visit.referrer, 'www.google.com', 'referring host only, as before');
        assert.equal(visit.deviceType, 'desktop', 'still derived from the user-agent, which is never stored');
        assert.equal(visit.city, 'Delhi');
    });

    test('action events are untouched by location tracking', async () => {
        const session = sessionId();
        await track('49.36.1.10', { session });
        const res = await call('POST', '/public/analytics/event', {
            ip: '49.36.1.10',
            body: { sessionId: session, action: 'loan_application_click', path: '/loans' }
        });
        assert.equal(res.status, 201);
        const raw = await mongoose.connection.db.collection('websiteevents').find({}).toArray();
        assert.equal(raw.length, 1);
        assert.deepEqual(Object.keys(raw[0]).filter((k) => ['city', 'country', 'region', 'ip'].includes(k)), [], 'events carry no location or address');
        const data = (await overview({ range: '7d' })).body.data;
        assert.equal(data.kpis.loanApplicationClicks, 1);
    });
});

// ── Retention ─────────────────────────────────────────────────────────────────
// The privacy policy says analytics data is kept for 12 months. That is
// enforced by MongoDB's own TTL expiry, not by application code: nothing here
// (and nothing in the app) ever deletes an analytics record itself.
describe('Analytics retention', () => {
    const ttlOf = async (model) => {
        await model.syncIndexes();
        const indexes = await model.collection.indexes();
        return indexes.filter((i) => i.expireAfterSeconds !== undefined);
    };

    test('page views expire 12 months after the view, by the viewedAt index', async () => {
        const [ttl, ...extra] = await ttlOf(WebsiteVisit);
        assert.equal(extra.length, 0, 'exactly one expiring index');
        assert.deepEqual(ttl.key, { viewedAt: 1 });
        assert.equal(ttl.name, 'viewedAt_ttl');
        assert.equal(ttl.expireAfterSeconds, 365 * 24 * 60 * 60);
        assert.equal(WebsiteVisit.RETENTION_SECONDS, 31536000);
    });

    test('actions expire 12 months after they happened, by the occurredAt index', async () => {
        const [ttl, ...extra] = await ttlOf(WebsiteEvent);
        assert.equal(extra.length, 0, 'exactly one expiring index');
        assert.deepEqual(ttl.key, { occurredAt: 1 });
        assert.equal(ttl.name, 'occurredAt_ttl');
        assert.equal(ttl.expireAfterSeconds, 365 * 24 * 60 * 60);
    });

    test('the expiring field is always set on a new record', async () => {
        await track('49.36.1.10');
        const session = sessionId();
        await track('49.36.1.10', { session });
        await call('POST', '/public/analytics/event', { ip: '49.36.1.10', body: { sessionId: session, action: 'phone_click', path: '/loans' } });

        const visits = await WebsiteVisit.find({}).lean();
        const events = await WebsiteEvent.find({}).lean();
        assert.ok(visits.length >= 2 && events.length === 1);
        for (const v of visits) {
            assert.ok(v.viewedAt instanceof Date && !Number.isNaN(v.viewedAt.getTime()), 'viewedAt is a real date');
            assert.ok(Math.abs(Date.now() - v.viewedAt.getTime()) < 60000, 'and it is the server\'s own clock');
        }
        for (const e of events) {
            assert.ok(e.occurredAt instanceof Date && !Number.isNaN(e.occurredAt.getTime()));
            assert.ok(Math.abs(Date.now() - e.occurredAt.getTime()) < 60000);
        }
    });

    test('the indexes the dashboard relies on are still there', async () => {
        const visitKeys = (await WebsiteVisit.collection.indexes()).map((i) => JSON.stringify(i.key));
        for (const key of [{ _id: 1 }, { viewedAt: 1 }, { sessionId: 1, viewedAt: -1 }, { path: 1, viewedAt: -1 }, { city: 1, viewedAt: -1 }]) {
            assert.ok(visitKeys.includes(JSON.stringify(key)), `missing ${JSON.stringify(key)}`);
        }
        assert.equal(visitKeys.length, 5, 'no duplicate index on the same field');

        const eventKeys = (await WebsiteEvent.collection.indexes()).map((i) => JSON.stringify(i.key));
        for (const key of [{ _id: 1 }, { occurredAt: 1 }, { action: 1, occurredAt: -1 }, { sessionId: 1, occurredAt: -1 }]) {
            assert.ok(eventKeys.includes(JSON.stringify(key)), `missing ${JSON.stringify(key)}`);
        }
        assert.equal(eventKeys.length, 4);
    });

    test('recording and reading analytics is unchanged by retention', async () => {
        await seedVisit({ city: 'Lucknow', at: daysAgo(2) });
        await seedVisit({ city: 'Delhi' });
        const data = (await overview({ range: '7d' })).body.data;
        assert.equal(data.kpis.visitors, 2);
        assert.equal(data.kpis.pageViews, 2);
        assert.equal(data.location.knownVisitors, 2);
        assert.equal(await WebsiteVisit.countDocuments(), 2, 'nothing was deleted by reading or writing');
    });
});
