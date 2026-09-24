const net = require('net');
const fs = require('fs');
const maxmind = require('maxmind');
const env = require('../config/env');
const logger = require('../utils/logger');

// City-level location for website analytics, resolved on this server.
//
//   req.ip ─► publicIp() ─► locate() ─► { country, region, city }
//
// The lookup uses a local city database in MaxMind's MMDB format
// (GEOIP_CITY_DB_PATH). Production uses DB-IP City Lite; a MaxMind GeoLite2
// City file works just as well, since both use the same record layout
// (city.names.en, subdivisions[].names.en, country.names.en). Whichever is
// installed, no visitor IP is ever sent to a third party, stored, hashed or
// logged: the address exists only for the microseconds of the lookup, and only
// the place names are returned and saved with the page view.
//
// Everything here is best-effort. With no database file, an unreadable file, a
// private or malformed address, or any error at all, the answer is simply "no
// location" and the page view is recorded without one.

const MAX_NAME = 120;

// DB-IP City Lite qualifies many city names with the district or area, as in
// "Navi Mumbai (Ghansoli)" or "Lucknow (Hazratganj)". Traffic by City counts
// cities, so the qualifier is dropped and the visits add up under one name.
const districtSuffix = /\s*\([^()]*\)\s*$/;

// Reserved and non-routable ranges. An address in one of these belongs to a
// network, not a place: development machines, office LANs behind NAT, and
// carrier-grade NAT pools that no city database can resolve.
const PRIVATE_V4 = [
    [/^0\./, 'this network'],
    [/^10\./, 'private'],
    [/^127\./, 'loopback'],
    [/^169\.254\./, 'link-local'],
    [/^172\.(1[6-9]|2\d|3[01])\./, 'private'],
    [/^192\.168\./, 'private'],
    [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'carrier-grade NAT'],
    [/^(22[4-9]|23\d)\./, 'multicast'],
    [/^255\.255\.255\.255$/, 'broadcast']
];

const isPrivateV4 = (ip) => PRIVATE_V4.some(([rx]) => rx.test(ip));

const isPrivateV6 = (ip) => {
    const v = ip.toLowerCase();
    return v === '::' || v === '::1'
        || /^f[cd][0-9a-f]{2}:/.test(v)      // unique local
        || /^fe[89ab][0-9a-f]:/.test(v);     // link-local
};

// The client address, or null when it is not a public address we can place.
// Only ever given req.ip, which Express derives using the app's trust-proxy
// setting — client-supplied headers are never read here.
const publicIp = (value) => {
    if (typeof value !== 'string') return null;
    let ip = value.trim();
    if (!ip) return null;
    // IPv4 written as IPv6 ("::ffff:49.36.1.10"), and zone ids ("fe80::1%eth0").
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
    if (mapped) ip = mapped[1];
    ip = ip.replace(/%.*$/, '');

    const version = net.isIP(ip);
    if (version === 4) return isPrivateV4(ip) ? null : ip;
    if (version === 6) return isPrivateV6(ip) ? null : ip;
    return null;
};

// The database is opened once, on first use, and kept in memory with the
// reader's own small LRU cache for repeated addresses. `null` means "not
// available" and is remembered, so a missing file is not retried per request.
let readerPromise = null;
let reader = null;
let unavailableReason = '';

const openReader = async () => {
    const path = env.GEOIP_CITY_DB_PATH;
    if (!path) {
        unavailableReason = 'GEOIP_CITY_DB_PATH is not set';
        return null;
    }
    if (!fs.existsSync(path)) {
        unavailableReason = 'the city database file was not found';
        logger.warn('GeoIP database not found; visits will have no location', { path });
        return null;
    }
    try {
        const opened = await maxmind.open(path, { cache: { max: 2000 } });
        // Which database is in use, and how old it is — both worth knowing
        // when a city looks wrong. Neither is a secret.
        logger.info('GeoIP database loaded', {
            path,
            databaseType: opened.metadata?.databaseType || 'unknown',
            built: opened.metadata?.buildEpoch instanceof Date ? opened.metadata.buildEpoch.toISOString() : ''
        });
        unavailableReason = '';
        return opened;
    } catch (err) {
        unavailableReason = 'the city database could not be opened';
        logger.warn('GeoIP database could not be opened; visits will have no location', { path, error: err.message });
        return null;
    }
};

const ready = () => {
    if (!readerPromise) {
        readerPromise = openReader().then((r) => {
            reader = r;
            return r;
        }).catch(() => null);
    }
    return readerPromise;
};

const name = (value) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_NAME) : null);

// A database record → the three names analytics keeps. English names are used
// so the dashboard reads consistently whatever the visitor's locale. Any part
// of a record we do not need — coordinates, continent, time zone, network —
// is ignored and never stored. A record with none of the three names is no
// location at all.
const placeOf = (record) => {
    if (!record) return null;
    const country = name(record.country?.names?.en || record.registered_country?.names?.en);
    const region = name(record.subdivisions?.[0]?.names?.en);
    const city = name(String(record.city?.names?.en || '').replace(districtSuffix, ''));
    if (!country && !region && !city) return null;
    return { country, region, city };
};

// → { country, region, city } or null. Never throws: analytics must be
// recorded whether or not a location could be found.
const locate = async (ip) => {
    const address = publicIp(ip);
    if (!address) return null;
    try {
        const r = await ready();
        if (!r) return null;
        return placeOf(r.get(address));
    } catch (err) {
        // The message is the library's, about the lookup — never the address.
        logger.warn('GeoIP lookup failed; the visit is recorded without a location', { error: err.message });
        return null;
    }
};

// For the admin/diagnostics view: whether locations can be resolved at all.
const status = async () => {
    await ready();
    return { available: !!reader, reason: reader ? '' : unavailableReason };
};

module.exports = {
    locate,
    publicIp,
    status,
    // Test seams: a fake reader, and a way to forget a cached one.
    _setReader: (fake) => {
        reader = fake;
        readerPromise = Promise.resolve(fake);
        unavailableReason = fake ? '' : 'no database';
    },
    _reset: () => {
        reader = null;
        readerPromise = null;
        unavailableReason = '';
    }
};
