const mongoose = require('mongoose');

const DEVICE_TYPES = ['mobile', 'tablet', 'desktop', 'unknown'];

// How long a page view is kept: 12 months, as the privacy policy states.
const RETENTION_SECONDS = 365 * 24 * 60 * 60;

// One document per page view on the public website.
//
// Deliberately anonymous: no IP address, no raw user-agent, no account or form
// data. `sessionId` is an opaque random value the browser generates for itself
// and expires after 30 minutes of inactivity — it identifies a browsing
// session, never a person, and cannot be traced back to one.
//
// The coarse location below is resolved from the request's IP on this server
// (services/geoip.service) and only the place names are kept: the address
// itself is never stored, hashed or logged. Null on every visit recorded
// before location lookup existed, and whenever an address cannot be placed.
//
// Visits are counted as distinct sessionIds over a range; page views are the
// document count. Keeping raw events (rather than pre-aggregated counters)
// means Top Pages and daily trends come from the same collection, and old
// events can later be rolled up or dropped without changing the admin API.
const websiteVisitSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 64
    },
    // Route path only — never the query string, which can carry ids a visitor
    // typed or was linked with.
    path: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    // Referring host only, not the full URL.
    referrer: {
        type: String,
        trim: true,
        default: '',
        maxlength: 200
    },
    deviceType: {
        type: String,
        enum: DEVICE_TYPES,
        default: 'unknown'
    },
    // Coarse location, English names, from the local GeoLite2 City database.
    country: { type: String, trim: true, default: null, maxlength: 120 },
    region: { type: String, trim: true, default: null, maxlength: 120 },
    city: { type: String, trim: true, default: null, maxlength: 120 },
    // When the browsing session began; lets a visit be attributed to its start.
    sessionStartedAt: { type: Date, required: true },
    viewedAt: { type: Date, default: Date.now }
}, {
    timestamps: false
});

// Every admin query filters on a viewedAt range first. The same index expires
// the record 12 months after the page view: MongoDB removes it in the
// background, so traffic data is kept for a year and no longer. Nothing is
// deleted by the application, and a single-field index serves range queries
// and sorts in either direction.
websiteVisitSchema.index(
    { viewedAt: 1 },
    { expireAfterSeconds: RETENTION_SECONDS, name: 'viewedAt_ttl' }
);
// Distinct-session counting within a range.
websiteVisitSchema.index({ sessionId: 1, viewedAt: -1 });
// Top Pages within a range.
websiteVisitSchema.index({ path: 1, viewedAt: -1 });
// Traffic by City within a range.
websiteVisitSchema.index({ city: 1, viewedAt: -1 });

module.exports = mongoose.model('WebsiteVisit', websiteVisitSchema);
module.exports.DEVICE_TYPES = DEVICE_TYPES;
module.exports.RETENTION_SECONDS = RETENTION_SECONDS;
