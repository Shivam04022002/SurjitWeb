const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Stable key from client IP + (optional) login email. Combining the two means a
// single shared public IP does NOT lock everyone out — each admin account is
// tracked independently, while a single account is still protected from
// brute-force across IPs of the same origin.
const loginKey = (req) => {
    const email = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    return `${ip}|${email}`;
};

// ── General API safety net (per IP) ──────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        errors: []
    }
});

// ── Login brute-force protection (per IP + email, failures only) ─────────────
const loginLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    // Only FAILED logins consume the budget; a 2xx login is not counted.
    skipSuccessfulRequests: true,
    keyGenerator: loginKey,
    // We intentionally build our own IP+email key; disable the IPv6 fallback check.
    validate: { keyGeneratorIpFallback: false },
    message: {
        success: false,
        message: 'Too many failed login attempts for this account. Please try again in a few minutes.',
        errors: []
    }
});

// ── Public review submission (per IP) ────────────────────────────────────────
// The general API limiter allows 1000 requests per 15 minutes, which is right
// for browsing but far too loose for an unauthenticated write that also takes
// a file. A handful per hour is well above what a real customer needs and well
// below what makes spamming worthwhile.
const reviewSubmissionLimiter = rateLimit({
    windowMs: env.REVIEW_RATE_LIMIT_WINDOW_MS,
    max: env.REVIEW_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'You have submitted several reviews recently. Please try again later.',
        errors: []
    }
});

// Clear a user's failed-attempt counter after a successful login.
const resetLoginLimiter = (req) => {
    try {
        loginLimiter.resetKey(loginKey(req));
    } catch (_) {
        /* no-op: store may not support resetKey */
    }
};

module.exports = { apiLimiter, loginLimiter, reviewSubmissionLimiter, resetLoginLimiter, loginKey };
