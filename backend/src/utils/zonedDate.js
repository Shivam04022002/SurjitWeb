const env = require('../config/env');

// Calendar-day helpers pinned to the business timezone.
//
// Analytics buckets by day, and "a day" has to mean the admin's day, not the
// server's or UTC's — otherwise a visit at 01:00 IST lands on the previous
// date and "Today" silently excludes the first five and a half hours. Days are
// passed around as 'YYYY-MM-DD' strings so no Date ever has to be interpreted
// in the wrong zone.

const TIMEZONE = env.ANALYTICS_TIMEZONE;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDay = (day) => day.split('-').map(Number);

// The calendar day an instant falls on, in the business timezone.
const dayOf = (date) => dayFormatter.format(date);

const today = () => dayOf(new Date());

// Offset of the business timezone from UTC at a given instant, in ms.
const offsetAt = (date) => {
    const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// The instant a calendar day begins in the business timezone.
const startOfDay = (day) => {
    const [y, m, d] = parseDay(day);
    const utcMidnight = Date.UTC(y, m - 1, d);
    return new Date(utcMidnight - offsetAt(new Date(utcMidnight)));
};

// Midday of a calendar day in the business timezone. Used where a date-only
// value has to become an instant: noon reads as the same calendar date in
// every timezone from UTC-11 to UTC+11, so the date never appears shifted.
const middayOf = (day) => new Date(startOfDay(day).getTime() + 12 * 60 * 60 * 1000);

// Pure calendar arithmetic — no timezone involved.
const addDays = (day, n) => {
    const [y, m, d] = parseDay(day);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const daysBetween = (from, to) => {
    const [y1, m1, d1] = parseDay(from);
    const [y2, m2, d2] = parseDay(to);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

// Rejects impossible dates such as 2026-02-31, which Date.UTC would roll over.
const isValidDay = (value) => {
    if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
    const [y, m, d] = parseDay(value);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

module.exports = { TIMEZONE, dayOf, today, startOfDay, middayOf, addDays, daysBetween, isValidDay };
