const WebsiteVisit = require('../models/WebsiteVisit');
const WebsiteEvent = require('../models/WebsiteEvent');
const env = require('../config/env');
const { EVENT_ACTIONS, CONTACT_ACTIONS } = require('../constants/analyticsEvents');
const zoned = require('../utils/zonedDate');

// Admin-selectable windows. Presets are an allowlist; a custom window is two
// validated calendar days (see analytics.validator), capped in span, so a
// client can never widen the query beyond MAX_CUSTOM_DAYS.
const RANGES = {
    today: { days: 0, label: 'Today' },
    '7d': { days: 6, label: 'Last 7 Days' },
    '30d': { days: 29, label: 'Last 30 Days' },
    '90d': { days: 89, label: 'Last 90 Days' },
    custom: { days: null, label: 'Custom Range' }
};

const MAX_CUSTOM_DAYS = 366;
const TOP_PAGES_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT = 15;

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

// Turns the request's range into concrete bounds. `start` is inclusive, `end`
// exclusive and never later than now, and `days` lists every calendar day in
// the window so a day with no traffic still appears as a zero.
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
        toDay = zoned.today();
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
const sessionsPipeline = (start, end) => [
    { $match: { viewedAt: { $gte: start, $lt: end } } },
    { $project: { _id: 0, sessionId: 1, at: '$viewedAt', view: { $literal: 1 }, referrer: 1, deviceType: 1 } },
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
            deviceType: { $first: '$deviceType' }
        }
    },
    { $match: { views: { $gt: 0 } } },
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
        // No location is collected (no IP is stored), so there is nothing to
        // report here. Stated explicitly so the dashboard can say so.
        location: { available: false }
    };
};

// Full, paginated Top Pages for the "View All" dialog.
const getPages = async ({ page = 1, limit = 25, ...rangeParams }) => {
    const r = resolveRange(rangeParams);
    const skip = (page - 1) * limit;
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

// Public write path. Only these four values are taken from the request; the
// timestamp is the server's, never the client's.
const recordPageView = async ({ sessionId, path, referrer, deviceType, sessionStartedAt }) => {
    await WebsiteVisit.create({
        sessionId,
        path,
        referrer: referrer || '',
        deviceType: deviceType || 'unknown',
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
    getOverview, getPages, recordPageView, recordEvent,
    classifySource, resolveRange, RANGES, MAX_CUSTOM_DAYS
};
