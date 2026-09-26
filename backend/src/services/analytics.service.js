const WebsiteVisit = require('../models/WebsiteVisit');
const WebsiteEvent = require('../models/WebsiteEvent');
const env = require('../config/env');
const { EVENT_ACTIONS, CONTACT_ACTIONS } = require('../constants/analyticsEvents');
// Analytics is reported in UTC, always. See utils/zonedDate.
const zoned = require('../utils/zonedDate').utc;
const geoip = require('./geoip.service');

// Admin-selectable windows, in UTC calendar days. Presets are an allowlist; a
// custom window is two validated calendar days (see analytics.validator),
// capped in span, so a client can never widen the query beyond MAX_CUSTOM_DAYS.
//
// `endsDaysAgo` is where the window's last day sits relative to today, and
// `days` how many days back from there it reaches. Yesterday is the only one
// that does not end today, which is why both are needed.
const RANGES = {
    today: { endsDaysAgo: 0, days: 0, label: 'Today' },
    yesterday: { endsDaysAgo: 1, days: 0, label: 'Yesterday' },
    '7d': { endsDaysAgo: 0, days: 6, label: 'Last 7 Days' },
    '30d': { endsDaysAgo: 0, days: 29, label: 'Last 30 Days' },
    '90d': { endsDaysAgo: 0, days: 89, label: 'Last 90 Days' },
    custom: { endsDaysAgo: null, days: null, label: 'Custom Range' }
};

const MAX_CUSTOM_DAYS = 366;
const TOP_PAGES_LIMIT = 10;
const TOP_CITIES_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT = 15;

// Hours of the UTC day, 00 through 23. Every window reports all of them, so a
// quiet hour reads as nought traffic rather than as a gap in the chart.
const HOURS_IN_DAY = 24;

// How many cities the hourly view offers in its city filter. The list exists to
// be chosen from; past a few hundred entries a dropdown is the wrong tool, and
// the search box is the right one.
const CITY_OPTIONS_LIMIT = 500;

const SOURCES = {
    direct: 'Direct',
    search: 'Search',
    social: 'Social',
    referral: 'Referral'
};

const DEVICES = {
    desktop: 'Desktop',
    mobile: 'Mobile',
    tablet: 'Tablet',
    unknown: 'Unknown'
};

// A search term as a literal, case-insensitive match: a city name is a term to
// look for, never a pattern to run.
const escapedRegex = (term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

const SEARCH_HOST = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|ask|aol|brave|qwant|startpage)\.|googlequicksearchbox/;
const SOCIAL_HOST = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|pinterest\.[a-z.]+|reddit\.com|quora\.com|telegram\.org|t\.me|threads\.net|snapchat\.com)$|com\.(facebook|instagram|linkedin|whatsapp)\./;

// The site's own hosts. A referrer from one of them is a reload or a return
// from another tab of this site, not a traffic source.
const OWN_HOSTS = new Set(
    String(env.CORS_ORIGIN || '').split(',').map((o) => {
        try { return new URL(o.trim()).hostname; } catch { return ''; }
    }).filter(Boolean)
);

// Only the referring host is stored, so this is the finest source resolution
// available. Anything that is not search or social is a referral.
const classifySource = (host) => {
    const h = String(host || '').toLowerCase();
    if (!h || OWN_HOSTS.has(h)) return 'direct';
    if (SEARCH_HOST.test(h)) return 'search';
    if (SOCIAL_HOST.test(h)) return 'social';
    return 'referral';
};

// Turns the request's range into concrete bounds, all in UTC. `start` is
// inclusive, `end` exclusive and never later than now, and `days` lists every
// UTC calendar day in the window so a day with no traffic still appears as a
// zero.
//
// Every boundary here comes from the UTC day helpers, never from a JavaScript
// local-time Date: a visit at 23:30 UTC belongs to that UTC day wherever the
// server happens to be running.
const resolveRange = ({ range, from, to } = {}) => {
    let key = RANGES[range] ? range : '7d';
    let fromDay;
    let toDay;

    if (key === 'custom') {
        if (zoned.isValidDay(from) && zoned.isValidDay(to) && from <= to) {
            fromDay = from;
            toDay = to;
        } else {
            key = '7d';
        }
    }
    if (key !== 'custom') {
        toDay = zoned.addDays(zoned.today(), -RANGES[key].endsDaysAgo);
        fromDay = zoned.addDays(toDay, -RANGES[key].days);
    }

    const now = new Date();
    const start = zoned.startOfDay(fromDay);
    const dayAfter = zoned.startOfDay(zoned.addDays(toDay, 1));
    const end = dayAfter < now ? dayAfter : now;

    const days = [];
    for (let d = fromDay; d <= toDay; d = zoned.addDays(d, 1)) days.push(d);

    return { key, label: RANGES[key].label, fromDay, toDay, start, end, days };
};

const dayExpr = (field) => ({
    $dateToString: { format: '%Y-%m-%d', date: field, timezone: zoned.TIMEZONE }
});

// The hour of the UTC day a moment falls in. The timezone is stated for the
// same reason the day helper states it: what "3 PM" means must not depend on
// how the server, or the reader's laptop, happens to be set. 3 PM is 15:00 UTC
// through 15:59:59.999 UTC, wherever anyone is sitting.
const hourExpr = (field) => ({ $hour: { date: field, timezone: zoned.TIMEZONE } });

// A selected hour, as a UTC hour of the day. Anything that is not one of 0–23
// means no hour was chosen — which is a different statement from hour zero, so
// midnight has to survive this untouched.
const normaliseHour = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < HOURS_IN_DAY ? n : null;
};

// Top Pages. Grouping on (path, session) first and then on path keeps each
// group's state to a counter — unlike $addToSet, it cannot grow with traffic.
const topPagesPipeline = (match, skip, limit) => [
    { $match: match },
    { $group: { _id: { path: '$path', s: '$sessionId' }, views: { $sum: 1 } } },
    { $group: { _id: '$_id.path', pageViews: { $sum: '$views' }, visitors: { $sum: 1 } } },
    { $sort: { pageViews: -1, _id: 1 } },
    {
        $facet: {
            rows: [
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 0, path: '$_id', pageViews: 1, visitors: 1 } }
            ],
            total: [{ $count: 'n' }]
        }
    }
];

// One row per session active in the window, built from its page views plus
// its tracked actions, so session length runs to the last thing the visitor
// did rather than stopping at their last page load.
//
// A visitor is a session: the site stores no persistent identifier, so the
// same person on two days counts twice. Sessions with actions but no page
// view inside the window (a view just before midnight, a click just after)
// are dropped — they began in an earlier window and were counted there.
const sessionStages = (start, end) => [
    { $match: { viewedAt: { $gte: start, $lt: end } } },
    { $project: { _id: 0, sessionId: 1, at: '$viewedAt', view: { $literal: 1 }, referrer: 1, deviceType: 1, city: 1, country: 1 } },
    {
        $unionWith: {
            coll: WebsiteEvent.collection.name,
            pipeline: [
                { $match: { occurredAt: { $gte: start, $lt: end } } },
                { $project: { _id: 0, sessionId: 1, at: '$occurredAt', view: { $literal: 0 } } }
            ]
        }
    },
    // Page views sort ahead of a same-instant action, so $first picks up the
    // referrer and device from the session's first page view.
    { $sort: { sessionId: 1, at: 1, view: -1 } },
    {
        $group: {
            _id: '$sessionId',
            views: { $sum: '$view' },
            actions: { $sum: { $subtract: [1, '$view'] } },
            firstAt: { $min: '$at' },
            lastAt: { $max: '$at' },
            referrer: { $first: '$referrer' },
            deviceType: { $first: '$deviceType' },
            // The city of the session's first page view: visits recorded
            // before location lookup existed, and addresses that cannot be
            // placed, have none.
            city: { $first: '$city' },
            // The country of that same first page view, where one was
            // resolved. Shown beside the city; never inferred from it.
            country: { $first: '$country' }
        }
    },
    { $match: { views: { $gt: 0 } } }
];

// One row per session, then the dashboard's facets over them.
const sessionsPipeline = (start, end) => [
    ...sessionStages(start, end),
    {
        $facet: {
            totals: [{
                $group: {
                    _id: null,
                    sessions: { $sum: 1 },
                    // A bounce is one page view and nothing else.
                    bounces: { $sum: { $cond: [{ $and: [{ $eq: ['$views', 1] }, { $eq: ['$actions', 0] }] }, 1, 0] } },
                    durationMs: { $sum: { $subtract: ['$lastAt', '$firstAt'] } }
                }
            }],
            byReferrer: [
                { $group: { _id: { $ifNull: ['$referrer', ''] }, visitors: { $sum: 1 } } }
            ],
            byReferrerDay: [
                { $group: { _id: { day: dayExpr('$firstAt'), referrer: { $ifNull: ['$referrer', ''] } }, visitors: { $sum: 1 } } }
            ],
            byDevice: [
                { $group: { _id: { $ifNull: ['$deviceType', 'unknown'] }, visitors: { $sum: 1 } } }
            ],
            byCity: [
                { $match: { city: { $nin: [null, ''] } } },
                { $group: { _id: '$city', visitors: { $sum: 1 }, country: { $first: '$country' } } },
                { $sort: { visitors: -1, _id: 1 } }
            ]
        }
    }
];

const getOverview = async (params) => {
    const r = resolveRange(params);
    const visitMatch = { viewedAt: { $gte: r.start, $lt: r.end } };
    const eventMatch = { occurredAt: { $gte: r.start, $lt: r.end } };

    const [dailyTraffic, sessionFacets, topPages, actionCounts, loanDaily, recentViews, recentEvents] = await Promise.all([
        WebsiteVisit.aggregate([
            { $match: visitMatch },
            { $group: { _id: { day: dayExpr('$viewedAt'), s: '$sessionId' }, views: { $sum: 1 } } },
            { $group: { _id: '$_id.day', pageViews: { $sum: '$views' }, visits: { $sum: 1 } } }
        ]),
        WebsiteVisit.aggregate(sessionsPipeline(r.start, r.end)).allowDiskUse(true),
        WebsiteVisit.aggregate(topPagesPipeline(visitMatch, 0, TOP_PAGES_LIMIT)),
        WebsiteEvent.aggregate([
            { $match: eventMatch },
            { $group: { _id: '$action', clicks: { $sum: 1 } } }
        ]),
        WebsiteEvent.aggregate([
            { $match: { ...eventMatch, action: 'loan_application_click' } },
            { $group: { _id: dayExpr('$occurredAt'), clicks: { $sum: 1 } } }
        ]),
        WebsiteVisit.find(visitMatch).sort({ viewedAt: -1 }).limit(RECENT_ACTIVITY_LIMIT)
            .select({ _id: 0, path: 1, viewedAt: 1 }).lean(),
        WebsiteEvent.find(eventMatch).sort({ occurredAt: -1 }).limit(RECENT_ACTIVITY_LIMIT)
            .select({ _id: 0, action: 1, path: 1, target: 1, occurredAt: 1 }).lean()
    ]);

    // ── Daily series ──
    const trafficByDay = new Map(dailyTraffic.map((d) => [d._id, d]));
    const loanByDay = new Map(loanDaily.map((d) => [d._id, d.clicks]));
    const daily = r.days.map((date) => ({
        date,
        visits: trafficByDay.get(date)?.visits || 0,
        pageViews: trafficByDay.get(date)?.pageViews || 0,
        loanApplicationClicks: loanByDay.get(date) || 0
    }));

    // ── Sessions: totals, sources, devices ──
    const facets = sessionFacets[0] || {};
    const totals = facets.totals?.[0] || { sessions: 0, bounces: 0, durationMs: 0 };

    const sourceCounts = Object.fromEntries(Object.keys(SOURCES).map((k) => [k, 0]));
    const referrers = [];
    for (const row of facets.byReferrer || []) {
        const source = classifySource(row._id);
        sourceCounts[source] += row.visitors;
        if (source !== 'direct') referrers.push({ host: row._id, source, visitors: row.visitors });
    }
    referrers.sort((a, b) => b.visitors - a.visitors || a.host.localeCompare(b.host));

    const sourceByDay = new Map(r.days.map((d) => [d, { date: d, direct: 0, search: 0, social: 0, referral: 0 }]));
    for (const row of facets.byReferrerDay || []) {
        const bucket = sourceByDay.get(row._id.day);
        if (bucket) bucket[classifySource(row._id.referrer)] += row.visitors;
    }

    // ── Traffic by City ── visitors are distinct sessions, exactly as for
    // devices. Sessions whose first page view carries no city (everything
    // recorded before location lookup, and addresses that cannot be placed)
    // are counted as unknown rather than guessed at.
    const cityRows = facets.byCity || [];
    const knownVisitors = cityRows.reduce((n, c) => n + c.visitors, 0);

    const deviceCounts = new Map((facets.byDevice || []).map((d) => [d._id, d.visitors]));
    const devices = Object.entries(DEVICES)
        .map(([key, label]) => ({ key, label, visitors: deviceCounts.get(key) || 0 }))
        // "Unknown" is only worth a row when something actually landed there.
        .filter((d) => d.key !== 'unknown' || d.visitors > 0);

    // ── Actions ──
    const clicksByAction = new Map(actionCounts.map((a) => [a._id, a.clicks]));
    const actions = Object.entries(EVENT_ACTIONS)
        .map(([action, label]) => ({ action, label, clicks: clicksByAction.get(action) || 0 }))
        .sort((a, b) => b.clicks - a.clicks);
    const contactBreakdown = CONTACT_ACTIONS.map((action) => ({
        action, label: EVENT_ACTIONS[action], clicks: clicksByAction.get(action) || 0
    }));

    // ── Recent activity ── path and action only; nothing about who.
    const recentActivity = [
        ...recentViews.map((v) => ({ type: 'view', at: v.viewedAt, path: v.path })),
        ...recentEvents.map((e) => ({
            type: 'action', at: e.occurredAt, path: e.path, target: e.target || '',
            action: e.action, label: EVENT_ACTIONS[e.action] || e.action
        }))
    ]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, RECENT_ACTIVITY_LIMIT);

    return {
        range: r.key,
        label: r.label,
        from: r.fromDay,
        to: r.toDay,
        timezone: zoned.TIMEZONE,
        kpis: {
            visitors: totals.sessions,
            pageViews: daily.reduce((n, d) => n + d.pageViews, 0),
            loanApplicationClicks: clicksByAction.get('loan_application_click') || 0,
            contactClicks: contactBreakdown.reduce((n, a) => n + a.clicks, 0),
            contactBreakdown,
            // Null rather than 0 when there were no sessions: "no data" and
            // "zero seconds" are different statements.
            avgSessionDurationSec: totals.sessions ? Math.round(totals.durationMs / totals.sessions / 1000) : null,
            bounceRate: totals.sessions ? totals.bounces / totals.sessions : null
        },
        daily,
        topPages: {
            rows: topPages[0]?.rows || [],
            total: topPages[0]?.total?.[0]?.n || 0
        },
        sources: Object.entries(SOURCES).map(([key, label]) => ({ key, label, visitors: sourceCounts[key] })),
        referrers: referrers.slice(0, 5),
        sourceTrend: [...sourceByDay.values()],
        devices,
        actions,
        recentActivity,
        // Coarse location only, and only for visits recorded since location
        // lookup was configured. No address is stored or returned, ever.
        location: {
            available: knownVisitors > 0,
            enabled: (await geoip.status()).available,
            cities: cityRows.slice(0, TOP_CITIES_LIMIT).map((c) => ({
                city: c._id, country: c.country || null, visitors: c.visitors
            })),
            totalCities: cityRows.length,
            knownVisitors,
            unknownVisitors: Math.max(0, totals.sessions - knownVisitors),
            visitors: totals.sessions
        }
    };
};

// Full, paginated Top Pages for the "View All" dialog.
// Paging, as numbers. Express 5 hands `req.query` back freshly parsed on every
// read, so a validator's toInt() never reaches the handler — these arrive as
// strings, and a string in a $limit stage is an error from the driver.
const paging = (page, limit, defaultLimit = 25) => {
    const size = Math.min(Math.max(parseInt(limit, 10) || defaultLimit, 1), 100);
    const n = Math.max(parseInt(page, 10) || 1, 1);
    return { page: n, limit: size, skip: (n - 1) * size };
};

const getPages = async ({ page: requestedPage, limit: requestedLimit, ...rangeParams }) => {
    const r = resolveRange(rangeParams);
    const { page, limit, skip } = paging(requestedPage, requestedLimit);
    const [result] = await WebsiteVisit.aggregate(
        topPagesPipeline({ viewedAt: { $gte: r.start, $lt: r.end } }, skip, limit)
    );
    return {
        range: r.key,
        from: r.fromDay,
        to: r.toDay,
        page,
        limit,
        total: result?.total?.[0]?.n || 0,
        rows: result?.rows || []
    };
};

// Every city in the window, paginated — the "See All" view behind the
// dashboard's Traffic by City card.
//
// A visitor is a session, counted on the city of its first page view: the same
// definition the card uses, from the same pipeline, so the two can never
// disagree. Sessions whose first view has no city are not a city — they stay
// in their own unknown count rather than being folded into one.
//
// Search narrows which cities are listed, never how they were counted.
const getCities = async ({ page: requestedPage, limit: requestedLimit, search = '', ...rangeParams } = {}) => {
    const r = resolveRange(rangeParams);
    const { page, limit, skip } = paging(requestedPage, requestedLimit);

    const term = String(search || '').trim();
    // Escaped: a city name is a search term, never a pattern.
    const searchStage = term
        ? [{ $match: { _id: escapedRegex(term) } }]
        : [];

    const hasCity = [{ $match: { city: { $nin: [null, ''] } } }];
    const byCity = [{ $group: { _id: '$city', visitors: { $sum: 1 }, country: { $first: '$country' } } }];
    const ranked = [{ $sort: { visitors: -1, _id: 1 } }];

    // One pass over the sessions, four questions asked of it. Not nested
    // facets — MongoDB does not allow those — just four plain branches.
    const [facets] = await WebsiteVisit.aggregate([
        ...sessionStages(r.start, r.end),
        {
            $facet: {
                rows: [
                    ...hasCity, ...byCity, ...ranked, ...searchStage,
                    { $skip: skip }, { $limit: limit },
                    { $project: { _id: 0, city: '$_id', country: 1, visitors: 1 } }
                ],
                matching: [...hasCity, ...byCity, ...searchStage, { $count: 'n' }],
                allCities: [...hasCity, ...byCity, { $count: 'n' }],
                totals: [{
                    $group: {
                        _id: null,
                        visitors: { $sum: 1 },
                        known: { $sum: { $cond: [{ $in: ['$city', [null, '']] }, 0, 1] } }
                    }
                }]
            }
        }
    ]).allowDiskUse(true);

    const totals = facets?.totals?.[0] || { visitors: 0, known: 0 };

    return {
        range: r.key,
        label: r.label,
        from: r.fromDay,
        to: r.toDay,
        timezone: zoned.TIMEZONE,
        search: term,
        page,
        limit,
        // What the pagination counts: the cities this search matched.
        total: facets?.matching?.[0]?.n || 0,
        // How many there are in the window, whatever the search.
        totalCities: facets?.allCities?.[0]?.n || 0,
        visitors: totals.visitors,
        knownVisitors: totals.known,
        // Sessions whose first page view carried no city. A real number, kept
        // separate — never turned into a city of its own.
        unknownVisitors: Math.max(0, totals.visitors - totals.known),
        rows: facets?.rows || []
    };
};

// Traffic by city and by hour of the UTC day — what the dedicated Traffic by
// City page reads.
//
// The question this answers is "who was here at 3 PM?", so a visitor is placed
// in the hour their session began, the same page view that gives them their
// city. One session therefore falls in exactly one hour, and the 24 hourly
// figures add up to the window's visitors.
//
// Over a multi-day window an hour means that hour on every day in it: Last 7
// Days at 3 PM is seven 15:00–15:59 UTC windows, not one continuous hour.
// Matching on the hour of the day rather than on a span of time is what makes
// that so.
//
// Three scopes are at work, and they are deliberately different:
//   · the hourly profile takes the city filter but not the hour — otherwise
//     choosing an hour would flatten the chart used to choose it;
//   · the city rows and totals take both;
//   · the filter's list of cities takes neither, so the choices do not shrink
//     to whatever the current hour happens to contain.
const getCityHourly = async ({
    page: requestedPage, limit: requestedLimit, search = '', hour, city, ...rangeParams
} = {}) => {
    const r = resolveRange(rangeParams);
    const { page, limit, skip } = paging(requestedPage, requestedLimit);

    const term = String(search || '').trim();
    const selectedHour = normaliseHour(hour);
    const selectedCity = String(city || '').trim();

    // Escaped: a city name is a search term, never a pattern.
    const searchStage = term ? [{ $match: { _id: escapedRegex(term) } }] : [];
    const hasCity = [{ $match: { city: { $nin: [null, ''] } } }];
    const byCity = [{
        $group: {
            _id: '$city',
            visitors: { $sum: 1 },
            pageViews: { $sum: '$views' },
            country: { $first: '$country' }
        }
    }];
    const ranked = [{ $sort: { visitors: -1, _id: 1 } }];

    const cityFilter = selectedCity ? [{ $match: { city: selectedCity } }] : [];
    const hourFilter = selectedHour === null ? [] : [{ $match: { hourOfDay: selectedHour } }];
    const scope = [...cityFilter, ...hourFilter];

    // One pass over the sessions in the window; each branch asks its own
    // question of them. Not nested facets — MongoDB does not allow those.
    const [facets] = await WebsiteVisit.aggregate([
        ...sessionStages(r.start, r.end),
        { $addFields: { hourOfDay: hourExpr('$firstAt') } },
        {
            $facet: {
                rows: [
                    ...scope, ...hasCity, ...byCity, ...ranked, ...searchStage,
                    { $skip: skip }, { $limit: limit },
                    { $project: { _id: 0, city: '$_id', country: 1, visitors: 1, pageViews: 1 } }
                ],
                // What the pagination counts: the cities this search matched.
                matching: [...scope, ...hasCity, ...byCity, ...searchStage, { $count: 'n' }],
                // How many cities the current filters leave, whatever the search.
                allCities: [...scope, ...hasCity, ...byCity, { $count: 'n' }],
                // How many there are in the window, whatever any filter says.
                windowCities: [...hasCity, ...byCity, { $count: 'n' }],
                totals: [...scope, {
                    $group: {
                        _id: null,
                        visitors: { $sum: 1 },
                        pageViews: { $sum: '$views' },
                        known: { $sum: { $cond: [{ $in: ['$city', [null, '']] }, 0, 1] } }
                    }
                }],
                hourly: [
                    ...cityFilter,
                    { $group: { _id: '$hourOfDay', visitors: { $sum: 1 }, pageViews: { $sum: '$views' } } }
                ],
                cityOptions: [
                    ...hasCity, ...byCity, ...ranked,
                    { $limit: CITY_OPTIONS_LIMIT },
                    { $project: { _id: 0, city: '$_id' } }
                ]
            }
        }
    ]).allowDiskUse(true);

    const totals = facets?.totals?.[0] || { visitors: 0, known: 0, pageViews: 0 };
    const byHour = new Map((facets?.hourly || []).map((h) => [h._id, h]));

    return {
        range: r.key,
        label: r.label,
        from: r.fromDay,
        to: r.toDay,
        timezone: zoned.TIMEZONE,
        // Null, not zero: no hour chosen is not the same as midnight.
        hour: selectedHour,
        city: selectedCity || null,
        search: term,
        page,
        limit,
        total: facets?.matching?.[0]?.n || 0,
        totalCities: facets?.allCities?.[0]?.n || 0,
        windowCities: facets?.windowCities?.[0]?.n || 0,
        visitors: totals.visitors,
        pageViews: totals.pageViews,
        knownVisitors: totals.known,
        // Sessions whose first page view carried no city. A real number, kept
        // separate — never turned into a city of its own.
        unknownVisitors: Math.max(0, totals.visitors - totals.known),
        // All 24 hours, always, so a quiet hour reads as nought.
        hourly: Array.from({ length: HOURS_IN_DAY }, (_, h) => ({
            hour: h,
            visitors: byHour.get(h)?.visitors || 0,
            pageViews: byHour.get(h)?.pageViews || 0
        })),
        rows: facets?.rows || [],
        cityOptions: (facets?.cityOptions || []).map((c) => c.city)
    };
};

// Public write path. Only these values are taken from the request; the
// timestamp is the server's, never the client's. `location` is the coarse
// place the controller resolved (never an address), or nothing at all.
const recordPageView = async ({ sessionId, path, referrer, deviceType, sessionStartedAt, location }) => {
    await WebsiteVisit.create({
        sessionId,
        path,
        referrer: referrer || '',
        deviceType: deviceType || 'unknown',
        country: location?.country || null,
        region: location?.region || null,
        city: location?.city || null,
        sessionStartedAt: sessionStartedAt || new Date(),
        viewedAt: new Date()
    });
    return { recorded: true };
};

const recordEvent = async ({ sessionId, action, path, target }) => {
    await WebsiteEvent.create({
        sessionId,
        action,
        path,
        target: target || '',
        occurredAt: new Date()
    });
    return { recorded: true };
};

module.exports = {
    getOverview, getPages, getCities, getCityHourly, recordPageView, recordEvent,
    classifySource, resolveRange, normaliseHour, RANGES, MAX_CUSTOM_DAYS, HOURS_IN_DAY
};
