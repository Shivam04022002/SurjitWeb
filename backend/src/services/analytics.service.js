const WebsiteVisit = require('../models/WebsiteVisit');

// Admin-selectable windows. An allowlist rather than free-form dates, so a
// client can never widen the query or inject its own range.
const RANGES = {
    today: { days: 0, label: 'Today' },
    '7d': { days: 6, label: 'Last 7 Days' },
    '30d': { days: 29, label: 'Last 30 Days' }
};

const TOP_PAGES_LIMIT = 10;

// Start of the window, in server time. `today` means midnight today; 7d/30d
// mean the start of the day N-1 days ago, so both ends are whole days and the
// daily series has no partial leading bucket.
const startOfRange = (range) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - RANGES[range].days);
    return start;
};

const isoDay = (d) => d.toISOString().slice(0, 10);

// Every bucket in the window, so a day with no traffic still appears as a zero
// rather than a gap in the chart.
const emptyDailySeries = (start, end) => {
    const out = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        out.push({ date: isoDay(cursor), visits: 0, pageViews: 0 });
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
};

// Three aggregations over the same indexed range: totals, per-day, top paths.
// None of them load raw events into the application.
const getOverview = async (rangeKey) => {
    const range = RANGES[rangeKey] ? rangeKey : '7d';
    const start = startOfRange(range);
    const now = new Date();
    const match = { viewedAt: { $gte: start, $lte: now } };

    const [totals, daily, topPages] = await Promise.all([
        WebsiteVisit.aggregate([
            { $match: match },
            { $group: { _id: null, pageViews: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
            { $project: { _id: 0, pageViews: 1, totalVisits: { $size: '$sessions' } } }
        ]),
        WebsiteVisit.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$viewedAt' } },
                    pageViews: { $sum: 1 },
                    sessions: { $addToSet: '$sessionId' }
                }
            },
            { $project: { _id: 0, date: '$_id', pageViews: 1, visits: { $size: '$sessions' } } },
            { $sort: { date: 1 } }
        ]),
        WebsiteVisit.aggregate([
            { $match: match },
            { $group: { _id: '$path', pageViews: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
            { $project: { _id: 0, path: '$_id', pageViews: 1, visits: { $size: '$sessions' } } },
            { $sort: { pageViews: -1, path: 1 } },
            { $limit: TOP_PAGES_LIMIT }
        ])
    ]);

    // Merge the sparse per-day result onto a complete day series.
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const series = emptyDailySeries(start, now).map((d) => {
        const hit = byDate.get(d.date);
        return hit ? { date: d.date, visits: hit.visits, pageViews: hit.pageViews } : d;
    });

    return {
        range,
        label: RANGES[range].label,
        from: start.toISOString(),
        to: now.toISOString(),
        totalVisits: totals[0] ? totals[0].totalVisits : 0,
        totalPageViews: totals[0] ? totals[0].pageViews : 0,
        daily: series,
        topPages
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

module.exports = { getOverview, recordPageView, RANGES };
