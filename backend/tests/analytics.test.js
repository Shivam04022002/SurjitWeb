// Website analytics: the anonymous beacons, the city lookup and the admin
// overview — end-to-end over HTTP against an in-memory MongoDB.
//
// Nothing here touches a real city database or the network: the reader is a
// fake shaped like DB-IP City Lite, so every lookup outcome (hit, miss, error,
// no database) is exercised.
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

// ── Fake city-database reader ─────────────────────────────────────────────────
// Records are shaped exactly like DB-IP City Lite's: English city and
// subdivision names, an ISO country code, coordinates and a continent — and no
// registered_country. Coordinates are present precisely to prove they are
// never stored.
const place = (city, region, country, iso = 'IN') => ({
    city: { names: { en: city } },
    continent: { code: 'AS', names: { en: 'Asia' } },
    country: { geoname_id: 1269750, is_in_european_union: false, iso_code: iso, names: { en: country } },
    location: { latitude: 26.8467, longitude: 80.9462 },
    subdivisions: [{ names: { en: region } }]
});
const RECORDS = {
    '49.36.1.10': place('Lucknow', 'Uttar Pradesh', 'India'),
    '103.21.58.7': place('Delhi', 'Delhi', 'India'),
    '2401:4900:1c80::5': place('Mumbai', 'Maharashtra', 'India'),
    // DB-IP qualifies many city names with a district.
    '106.51.1.1': place('Navi Mumbai (Ghansoli)', 'Maharashtra', 'India'),
    // A country-only answer: no city or subdivision for this address.
    '8.8.8.8': { country: { names: { en: 'United States' }, iso_code: 'US' }, location: { latitude: 37.4, longitude: -122.1 } },
    // City and country, but no subdivision.
    '1.1.1.1': { city: { names: { en: 'Sydney' } }, country: { names: { en: 'Australia' }, iso_code: 'AU' } },
    // A record with nothing we keep.
    '198.18.0.1': { continent: { code: 'NA' }, location: { latitude: 0, longitude: 0 } }
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
    env.GEOIP_CITY_DB_PATH = '/test/dbip-city-lite.mmdb';
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
        env.GEOIP_CITY_DB_PATH = '/does/not/exist/dbip-city-lite.mmdb';
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
            { city: 'Delhi', country: null, visitors: 3 },
            { city: 'Lucknow', country: null, visitors: 2 },
            { city: 'Mumbai', country: null, visitors: 1 }
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
        assert.deepEqual(location.cities, [{ city: 'Lucknow', country: null, visitors: 1 }]);
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

// ── DB-IP City Lite mapping ───────────────────────────────────────────────────
// The production database is DB-IP City Lite; a MaxMind GeoLite2 City file has
// the same record layout and works unchanged.
describe('City database record mapping', () => {
    test('city, region and country come from the English names', async () => {
        assert.deepEqual(await geoip.locate('103.21.58.7'), { country: 'India', region: 'Delhi', city: 'Delhi' });
    });

    test('a district-qualified city name is reduced to the city', async () => {
        assert.deepEqual(await geoip.locate('106.51.1.1'), { country: 'India', region: 'Maharashtra', city: 'Navi Mumbai' });
        await track('106.51.1.1');
        assert.equal((await WebsiteVisit.findOne().lean()).city, 'Navi Mumbai', 'one city, not one per district');
    });

    test('a record with no city keeps the country', async () => {
        assert.deepEqual(await geoip.locate('8.8.8.8'), { country: 'United States', region: null, city: null });
    });

    test('a record with no subdivision keeps city and country', async () => {
        assert.deepEqual(await geoip.locate('1.1.1.1'), { country: 'Australia', region: null, city: 'Sydney' });
    });

    test('a record with none of the three names is no location at all', async () => {
        assert.equal(await geoip.locate('198.18.0.1'), null);
    });

    test('an address the database does not know is no location', async () => {
        assert.equal(await geoip.locate('203.0.113.9'), null);
    });

    test('coordinates, continent and country code are read but never stored', async () => {
        await track('49.36.1.10');
        const raw = await mongoose.connection.db.collection('websitevisits').findOne({});
        const json = JSON.stringify(raw);
        for (const unwanted of ['latitude', 'longitude', 'location', 'continent', 'iso_code', 'countryCode', 'geoname']) {
            assert.ok(!json.includes(unwanted), `${unwanted} must not be stored`);
        }
        assert.deepEqual(
            { country: raw.country, region: raw.region, city: raw.city },
            { country: 'India', region: 'Uttar Pradesh', city: 'Lucknow' }
        );
    });

    test('a missing database is reported once, not on every page view', async () => {
        env.GEOIP_CITY_DB_PATH = '/does/not/exist/dbip-city-lite.mmdb';
        geoip._reset();
        const before = captured.filter((l) => l.includes('GeoIP database not found')).length;
        for (let i = 0; i < 5; i++) await track('49.36.1.10');
        const after = captured.filter((l) => l.includes('GeoIP database not found')).length;
        assert.equal(after - before, 1, 'the file is checked once, then remembered');
        assert.equal(await WebsiteVisit.countDocuments(), 5, 'every visit is still recorded');
        assert.equal((await WebsiteVisit.findOne().lean()).city, null);
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


// -- Reporting is in UTC ------------------------------------------------------
// A figure on this dashboard has to mean the same thing to everyone who reads
// it, so every window is a UTC calendar day. The tests that matter most are the
// ones near midnight: a visit at 23:30 UTC belongs to that UTC day, and one at
// 00:30 UTC to the next, whatever timezone the server or the reader is in.
describe('Analytics reporting timezone', () => {
    const utc = require('../src/utils/zonedDate').utc;
    const { resolveRange, RANGES } = require('../src/services/analytics.service');

    const atUtc = (iso) => new Date(iso);
    const dayOf = (date) => date.toISOString().slice(0, 10);

    test('the reporting clock is UTC, not the business timezone', () => {
        assert.equal(utc.TIMEZONE, 'UTC');
        // And the business clock is left where it was, for blog scheduling.
        assert.equal(require('../src/utils/zonedDate').TIMEZONE, env.ANALYTICS_TIMEZONE);
    });

    test('a UTC day begins at midnight UTC exactly', () => {
        assert.equal(utc.startOfDay('2026-01-15').toISOString(), '2026-01-15T00:00:00.000Z');
        assert.equal(utc.startOfDay('2026-06-15').toISOString(), '2026-06-15T00:00:00.000Z',
            'and does not move with any daylight saving');
    });

    test('an instant near midnight falls on the UTC day it belongs to', () => {
        // 23:30 UTC is still that day; 00:30 UTC is already the next. In
        // Asia/Kolkata both of these read as the following calendar date, which
        // is exactly the confusion this pins down.
        assert.equal(utc.dayOf(atUtc('2026-03-10T23:30:00Z')), '2026-03-10');
        assert.equal(utc.dayOf(atUtc('2026-03-11T00:30:00Z')), '2026-03-11');
        assert.equal(utc.dayOf(atUtc('2026-03-10T23:59:59.999Z')), '2026-03-10');
        assert.equal(utc.dayOf(atUtc('2026-03-11T00:00:00.000Z')), '2026-03-11');
    });

    test('the UTC day differs from the business day, which is the point', () => {
        const business = require('../src/utils/zonedDate');
        const lateEvening = atUtc('2026-03-10T20:00:00Z');   // 01:30 next day in IST
        assert.equal(utc.dayOf(lateEvening), '2026-03-10');
        assert.equal(business.dayOf(lateEvening), '2026-03-11');
    });

    test('every preset resolves to UTC midnight boundaries', () => {
        for (const key of Object.keys(RANGES)) {
            if (key === 'custom') continue;
            const r = resolveRange({ range: key });
            assert.equal(r.start.getUTCHours(), 0, `${key} start hour`);
            assert.equal(r.start.getUTCMinutes(), 0, `${key} start minute`);
            assert.equal(r.start.getUTCSeconds(), 0, `${key} start second`);
            assert.equal(r.start.getUTCMilliseconds(), 0, `${key} start ms`);
            assert.equal(dayOf(r.start), r.fromDay, `${key} start is its own first day`);
        }
    });

    test('Today runs from this UTC midnight to now', () => {
        const r = resolveRange({ range: 'today' });
        const now = new Date();

        assert.equal(r.fromDay, utc.today());
        assert.equal(r.toDay, utc.today());
        assert.equal(r.start.toISOString(), `${utc.today()}T00:00:00.000Z`);
        assert.ok(r.end <= new Date(now.getTime() + 2000) && r.end >= now.getTime() - 5000,
            'the window ends at the current instant, not at the end of the day');
        assert.deepEqual(r.days, [utc.today()]);
    });

    test('Yesterday runs from the previous UTC midnight to this one', () => {
        const r = resolveRange({ range: 'yesterday' });
        const yesterday = utc.addDays(utc.today(), -1);

        assert.equal(r.fromDay, yesterday);
        assert.equal(r.toDay, yesterday);
        assert.equal(r.start.toISOString(), `${yesterday}T00:00:00.000Z`);
        assert.equal(r.end.toISOString(), `${utc.today()}T00:00:00.000Z`,
            'it stops at midnight, and never runs on into today');
        assert.deepEqual(r.days, [yesterday]);
    });

    test('Last 7 Days covers seven UTC days ending today', () => {
        const r = resolveRange({ range: '7d' });
        assert.equal(r.days.length, 7);
        assert.equal(r.toDay, utc.today());
        assert.equal(r.fromDay, utc.addDays(utc.today(), -6));
        assert.equal(r.start.toISOString(), `${r.fromDay}T00:00:00.000Z`);
    });

    test('Last 30 Days covers thirty UTC days ending today', () => {
        const r = resolveRange({ range: '30d' });
        assert.equal(r.days.length, 30);
        assert.equal(r.toDay, utc.today());
        assert.equal(r.fromDay, utc.addDays(utc.today(), -29));
        assert.equal(r.start.toISOString(), `${r.fromDay}T00:00:00.000Z`);
    });

    test('a custom range is read as UTC days, start inclusive and end exclusive', () => {
        const r = resolveRange({ range: 'custom', from: '2026-01-10', to: '2026-01-12' });

        assert.equal(r.key, 'custom');
        assert.equal(r.start.toISOString(), '2026-01-10T00:00:00.000Z');
        assert.equal(r.end.toISOString(), '2026-01-13T00:00:00.000Z', 'the last day is included in full');
        assert.deepEqual(r.days, ['2026-01-10', '2026-01-11', '2026-01-12']);
    });

    test('a single-day custom range is one whole UTC day', () => {
        const r = resolveRange({ range: 'custom', from: '2026-02-01', to: '2026-02-01' });
        assert.equal(r.start.toISOString(), '2026-02-01T00:00:00.000Z');
        assert.equal(r.end.toISOString(), '2026-02-02T00:00:00.000Z');
        assert.deepEqual(r.days, ['2026-02-01']);
    });

    test('an unusable custom range falls back rather than querying everything', () => {
        for (const bad of [
            { from: '2026-01-12', to: '2026-01-10' },
            { from: 'not-a-date', to: '2026-01-10' },
            { from: '2026-02-31', to: '2026-03-01' },
            {}
        ]) {
            const r = resolveRange({ range: 'custom', ...bad });
            assert.equal(r.key, '7d', JSON.stringify(bad));
        }
    });

    test('the overview reports UTC as its timezone', async () => {
        const res = await call('GET', '/v1/analytics/overview?range=today', { token });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.timezone, 'UTC');
    });
});

// -- A visit is counted on its UTC day ---------------------------------------
// The same scenario end to end: visits placed either side of a UTC midnight,
// then asked for through the API.
describe('UTC day boundaries in the overview', () => {
    const utc = require('../src/utils/zonedDate').utc;

    const at = (isoUtc) => new Date(isoUtc);
    const overview = async (query) => {
        const res = await call('GET', `/v1/analytics/overview?${query}`, { token });
        assert.equal(res.status, 200, res.text);
        return res.body.data;
    };

    test('Yesterday counts the visit at 23:30 and not the one at 00:30', async () => {
        const today = utc.today();
        const yesterday = utc.addDays(today, -1);

        await seedVisit({ sessionId: 'late-yesterday', at: at(`${yesterday}T23:30:00Z`) });
        await seedVisit({ sessionId: 'early-today', at: at(`${today}T00:30:00Z`) });

        const y = await overview('range=yesterday');
        assert.equal(y.from, yesterday);
        assert.equal(y.to, yesterday);
        assert.equal(y.kpis.pageViews, 1, 'only the 23:30 visit belongs to yesterday');
        assert.deepEqual(y.daily.map((d) => d.date), [yesterday]);
        assert.equal(y.daily[0].pageViews, 1);

        const t = await overview('range=today');
        assert.equal(t.kpis.pageViews, 1, 'only the 00:30 visit belongs to today');
        assert.equal(t.daily[0].date, today);
    });

    test('a visit one millisecond before UTC midnight is on the earlier day', async () => {
        const today = utc.today();
        const yesterday = utc.addDays(today, -1);

        await seedVisit({ sessionId: 'edge-before', at: at(`${yesterday}T23:59:59.999Z`) });
        await seedVisit({ sessionId: 'edge-after', at: at(`${today}T00:00:00.000Z`) });

        assert.equal((await overview('range=yesterday')).kpis.pageViews, 1);
        assert.equal((await overview('range=today')).kpis.pageViews, 1);
    });

    test('the daily series buckets each visit on its own UTC day', async () => {
        const today = utc.today();
        const days = [utc.addDays(today, -2), utc.addDays(today, -1), today];

        // Two visits late on the first day, one early on the second, none on
        // the third. In IST every one of these would land a day later.
        await seedVisit({ sessionId: 'a', at: at(`${days[0]}T22:00:00Z`) });
        await seedVisit({ sessionId: 'b', at: at(`${days[0]}T23:45:00Z`) });
        await seedVisit({ sessionId: 'c', at: at(`${days[1]}T00:15:00Z`) });

        const data = await overview(`range=custom&from=${days[0]}&to=${days[2]}`);
        const byDay = Object.fromEntries(data.daily.map((d) => [d.date, d.pageViews]));

        assert.deepEqual(data.daily.map((d) => d.date), days, 'every day in the window appears');
        assert.equal(byDay[days[0]], 2);
        assert.equal(byDay[days[1]], 1);
        assert.equal(byDay[days[2]], 0, 'a day with no traffic is a zero, not a gap');
    });

    test('a custom range excludes what falls outside it, to the millisecond', async () => {
        const today = utc.today();
        const from = utc.addDays(today, -5);
        const to = utc.addDays(today, -4);

        await seedVisit({ sessionId: 'before', at: at(`${utc.addDays(from, -1)}T23:59:59.999Z`) });
        await seedVisit({ sessionId: 'inside-start', at: at(`${from}T00:00:00.000Z`) });
        await seedVisit({ sessionId: 'inside-end', at: at(`${to}T23:59:59.999Z`) });
        await seedVisit({ sessionId: 'after', at: at(`${utc.addDays(to, 1)}T00:00:00.000Z`) });

        const data = await overview(`range=custom&from=${from}&to=${to}`);
        assert.equal(data.kpis.pageViews, 2, 'both boundary visits are in, neither neighbour is');
    });

    test('Last 7 Days reaches back exactly seven UTC days', async () => {
        const today = utc.today();

        await seedVisit({ sessionId: 'in-window', at: at(`${utc.addDays(today, -6)}T00:00:00.000Z`) });
        await seedVisit({ sessionId: 'just-outside', at: at(`${utc.addDays(today, -7)}T23:59:59.999Z`) });

        const data = await overview('range=7d');
        assert.equal(data.kpis.pageViews, 1);
        assert.equal(data.daily.length, 7);
    });

    test('Yesterday is offered as a range by the API', async () => {
        const res = await call('GET', '/v1/analytics/overview?range=yesterday', { token });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.body.data.range, 'yesterday');
        assert.equal(res.body.data.label, 'Yesterday');
    });
});


// -- Every city in the window ------------------------------------------------
// The dashboard card shows ten cities; this is the list behind its "See All".
// It counts the same way the card does — a visitor is a session, placed on the
// city of its first page view — so the two can never disagree.
describe('All cities', () => {
    const utc = require('../src/utils/zonedDate').utc;

    const cities = async (query = '') => {
        const res = await call('GET', `/v1/analytics/cities${query}`, { token });
        assert.equal(res.status, 200, res.text);
        return res.body.data;
    };

    // Fifteen cities, so the ten-row card definitely truncates and the tail is
    // made of ones and twos — exactly the rows that must not be dropped.
    const seedManyCities = async () => {
        const plan = [
            ['Mountain View', 12], ['Lucknow', 8], ['Mumbai', 7], ['Delhi', 6],
            ['Navi Mumbai', 5], ['Ashburn', 4], ['Chennai', 4], ['Pune', 3],
            ['Kolkata', 3], ['Jaipur', 2], ['Surat', 2], ['Indore', 1],
            ['Bhopal', 1], ['Nagpur', 1], ['Mountain Ash', 1]
        ];
        for (const [city, n] of plan) {
            for (let i = 0; i < n; i += 1) await seedVisit({ city });
        }
        return plan;
    };

    test('includes every city, not just the ten the card shows', async () => {
        const plan = await seedManyCities();

        const all = await cities('?range=7d&limit=100');
        assert.equal(all.totalCities, plan.length, 'every city is counted');
        assert.equal(all.total, plan.length);
        assert.equal(all.rows.length, plan.length, 'and every one is returned');

        // The card, for comparison: still ten.
        const card = (await overview({ range: '7d' })).body.data.location;
        assert.equal(card.cities.length, 10);
        assert.equal(card.totalCities, plan.length);
    });

    test('low-volume cities survive: the single-visitor tail is all there', async () => {
        await seedManyCities();
        const all = await cities('?range=7d&limit=100');

        const ones = all.rows.filter((r) => r.visitors === 1).map((r) => r.city).sort();
        assert.deepEqual(ones, ['Bhopal', 'Indore', 'Mountain Ash', 'Nagpur']);
    });

    test('counts match the card exactly, city for city', async () => {
        await seedManyCities();

        const all = await cities('?range=7d&limit=100');
        const card = (await overview({ range: '7d' })).body.data.location;
        const byCity = Object.fromEntries(all.rows.map((r) => [r.city, r.visitors]));

        for (const row of card.cities) {
            assert.equal(byCity[row.city], row.visitors, row.city);
        }
        assert.equal(all.visitors, card.visitors);
        assert.equal(all.knownVisitors, card.knownVisitors);
        assert.equal(all.unknownVisitors, card.unknownVisitors);
    });

    test('a visitor is a session, however many pages it viewed', async () => {
        const s = sessionId();
        await seedVisit({ sessionId: s, city: 'Lucknow' });
        await seedVisit({ sessionId: s, city: 'Lucknow', path: '/about' });
        await seedVisit({ sessionId: s, city: 'Lucknow', path: '/contact' });
        await seedVisit({ city: 'Lucknow' });

        const all = await cities('?range=7d');
        assert.deepEqual(all.rows, [{ city: 'Lucknow', country: null, visitors: 2 }]);
    });

    test('the country is carried through where one was resolved', async () => {
        await seedVisit({ city: 'Lucknow', country: 'India', region: 'Uttar Pradesh' });
        await seedVisit({ city: 'Ashburn', country: 'United States' });

        const rows = (await cities('?range=7d')).rows;
        assert.deepEqual(rows.find((r) => r.city === 'Lucknow').country, 'India');
        assert.deepEqual(rows.find((r) => r.city === 'Ashburn').country, 'United States');
    });

    test('unknown locations are kept as their own count, never as a city', async () => {
        await seedVisit({ city: 'Lucknow' });
        await seedVisit({});
        await seedVisit({ city: null });
        await seedVisit({ city: '' });

        const all = await cities('?range=7d');
        assert.deepEqual(all.rows.map((r) => r.city), ['Lucknow']);
        assert.equal(all.knownVisitors, 1);
        assert.equal(all.unknownVisitors, 3);
        assert.equal(all.visitors, 4);
        assert.equal(all.totalCities, 1, 'unknown is not a city');
    });

    // ── The global UTC window ────────────────────────────────────────────────

    test('Today includes only today\'s UTC traffic', async () => {
        const today = utc.today();
        const yesterday = utc.addDays(today, -1);

        await seedVisit({ city: 'Today City', at: new Date(`${today}T00:30:00Z`) });
        await seedVisit({ city: 'Yesterday City', at: new Date(`${yesterday}T23:30:00Z`) });

        const data = await cities('?range=today');
        assert.deepEqual(data.rows.map((r) => r.city), ['Today City']);
        assert.equal(data.from, today);
        assert.equal(data.to, today);
        assert.equal(data.timezone, 'UTC');
    });

    test('Yesterday includes only yesterday\'s UTC traffic', async () => {
        const today = utc.today();
        const yesterday = utc.addDays(today, -1);

        await seedVisit({ city: 'Today City', at: new Date(`${today}T00:30:00Z`) });
        await seedVisit({ city: 'Yesterday City', at: new Date(`${yesterday}T23:30:00Z`) });

        const data = await cities('?range=yesterday');
        assert.deepEqual(data.rows.map((r) => r.city), ['Yesterday City']);
        assert.equal(data.from, yesterday);
        assert.equal(data.to, yesterday);
    });

    test('a custom UTC range filters cities to its own days', async () => {
        const today = utc.today();
        const from = utc.addDays(today, -5);
        const to = utc.addDays(today, -4);

        await seedVisit({ city: 'Before', at: new Date(`${utc.addDays(from, -1)}T23:59:59.999Z`) });
        await seedVisit({ city: 'Inside Start', at: new Date(`${from}T00:00:00.000Z`) });
        await seedVisit({ city: 'Inside End', at: new Date(`${to}T23:59:59.999Z`) });
        await seedVisit({ city: 'After', at: new Date(`${utc.addDays(to, 1)}T00:00:00.000Z`) });

        const data = await cities(`?range=custom&from=${from}&to=${to}`);
        assert.deepEqual(data.rows.map((r) => r.city).sort(), ['Inside End', 'Inside Start']);
        assert.equal(data.totalCities, 2);
    });

    test('a narrower window changes the counts, not just the rows', async () => {
        await seedVisit({ city: 'Lucknow', at: new Date() });
        await seedVisit({ city: 'Lucknow', at: daysAgo(3) });
        await seedVisit({ city: 'Delhi', at: daysAgo(20) });

        const week = await cities('?range=7d');
        assert.deepEqual(week.rows, [{ city: 'Lucknow', country: null, visitors: 2 }]);

        const month = await cities('?range=30d');
        assert.deepEqual(month.rows.map((r) => r.city).sort(), ['Delhi', 'Lucknow']);
        assert.equal(month.rows.find((r) => r.city === 'Lucknow').visitors, 2);
    });

    // ── Search ───────────────────────────────────────────────────────────────

    test('search matches case-insensitively, anywhere in the name', async () => {
        await seedManyCities();

        for (const term of ['mountain', 'MOUNTAIN', 'Mountain', 'ountain']) {
            const data = await cities(`?range=7d&limit=100&search=${term}`);
            assert.deepEqual(data.rows.map((r) => r.city).sort(), ['Mountain Ash', 'Mountain View'], term);
        }
    });

    test('search narrows the list without touching the counts', async () => {
        await seedManyCities();

        const all = await cities('?range=7d&limit=100');
        const found = await cities('?range=7d&limit=100&search=mumbai');

        assert.deepEqual(found.rows.map((r) => r.city).sort(), ['Mumbai', 'Navi Mumbai']);
        assert.equal(found.rows.find((r) => r.city === 'Mumbai').visitors, 7, 'the count is what it always was');
        assert.equal(found.total, 2, 'pagination counts the matches');
        assert.equal(found.totalCities, all.totalCities, 'and the window still has every city in it');
        assert.equal(found.visitors, all.visitors);
        assert.equal(found.unknownVisitors, all.unknownVisitors);
    });

    test('a search that matches nothing is an empty list, not an error', async () => {
        await seedManyCities();
        const data = await cities('?range=7d&search=atlantis');

        assert.deepEqual(data.rows, []);
        assert.equal(data.total, 0);
        assert.ok(data.totalCities > 0, 'the window still has cities');
    });

    test('a search term is matched literally, never as a pattern', async () => {
        await seedVisit({ city: 'Lucknow' });
        await seedVisit({ city: 'Delhi' });

        // Regex metacharacters must find nothing rather than match everything.
        for (const term of ['.*', '^L', 'Luck.ow', '(Lucknow)', '[a-z]+']) {
            const data = await cities(`?range=7d&search=${encodeURIComponent(term)}`);
            assert.deepEqual(data.rows, [], term);
        }
    });

    // ── Pagination ───────────────────────────────────────────────────────────

    test('pagination returns the right slice, in rank order', async () => {
        const plan = await seedManyCities();
        const ranked = [...plan].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);

        const first = await cities('?range=7d&page=1&limit=5');
        assert.deepEqual(first.rows.map((r) => r.city), ranked.slice(0, 5));
        assert.equal(first.page, 1);
        assert.equal(first.limit, 5);

        const second = await cities('?range=7d&page=2&limit=5');
        assert.deepEqual(second.rows.map((r) => r.city), ranked.slice(5, 10));

        const third = await cities('?range=7d&page=3&limit=5');
        assert.deepEqual(third.rows.map((r) => r.city), ranked.slice(10, 15));

        // No page overlaps another, and together they are the whole list.
        const seen = [...first.rows, ...second.rows, ...third.rows].map((r) => r.city);
        assert.equal(new Set(seen).size, plan.length);
    });

    test('the total is the number of cities, not of pages or visits', async () => {
        const plan = await seedManyCities();
        const page = await cities('?range=7d&page=1&limit=5');

        assert.equal(page.total, plan.length);
        assert.equal(page.totalCities, plan.length);
        assert.equal(page.rows.length, 5, 'one page of them');
    });

    test('a page past the end is empty, and says so honestly', async () => {
        await seedManyCities();
        const data = await cities('?range=7d&page=99&limit=25');

        assert.deepEqual(data.rows, []);
        assert.equal(data.total, 15, 'the count still describes the whole list');
    });

    test('pagination and search work together', async () => {
        await seedManyCities();
        const data = await cities('?range=7d&search=a&page=1&limit=3');

        assert.equal(data.rows.length, 3);
        assert.ok(data.total > 3, 'more matches than fit on a page');
        assert.ok(data.rows.every((r) => /a/i.test(r.city)));
    });

    test('an empty window is an empty list with zeroed totals', async () => {
        const data = await cities('?range=today');

        assert.deepEqual(data.rows, []);
        assert.equal(data.total, 0);
        assert.equal(data.totalCities, 0);
        assert.equal(data.visitors, 0);
        assert.equal(data.knownVisitors, 0);
        assert.equal(data.unknownVisitors, 0);
    });

    // ── Access ───────────────────────────────────────────────────────────────

    test('the endpoint needs the analytics page, like the rest of the dashboard', async () => {
        assert.equal((await call('GET', '/v1/analytics/cities')).status, 401);
    });

    test('bad parameters are refused rather than guessed at', async () => {
        for (const q of ['?range=nonsense', '?page=0', '?limit=500', '?range=custom&from=2026-13-01&to=2026-13-02']) {
            const res = await call('GET', `/v1/analytics/cities${q}`, { token });
            assert.equal(res.status, 400, `${q} -> ${res.status}`);
        }
    });
});
