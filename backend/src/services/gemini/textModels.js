const env = require('../../config/env');
const logger = require('../../utils/logger');
const { MODEL_RX } = require('./geminiClient');

// Which Gemini text models blog generation may use, and which are resting.
//
// The API-page model is always tried first. After it come the free models an
// operator lists in GEMINI_FALLBACK_TEXT_MODELS — nothing is hardcoded, so no
// model the account would pay for is ever chosen automatically. Image, video,
// audio and embedding models are never valid fallbacks, whatever the list says.
//
// A model that answers 429 (quota) rests for as long as Google asks, or
// GEMINI_QUOTA_COOLDOWN_MS; one still overloaded after the client's retries
// (500/503) rests for GEMINI_OVERLOAD_COOLDOWN_MS. Resting models are skipped
// rather than called, so a spent quota is not hit again and again. PM2 runs
// one process, so in-memory state is the whole picture.

const NOT_A_FREE_TEXT_MODEL = /(image|imagen|veo|tts|audio|live|embedding|aqa|computer-use)/i;
const MAX_COOLDOWN_MS = 60 * 60 * 1000;

const cooldowns = new Map();

const fallbackList = () => String(env.GEMINI_FALLBACK_TEXT_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

const isEligibleFallback = (model) => MODEL_RX.test(model) && !NOT_A_FREE_TEXT_MODEL.test(model);

// The API-page model, then the eligible configured fallbacks, without repeats.
const candidateModels = (primary) => {
    const out = [primary];
    for (const m of fallbackList()) {
        if (out.includes(m)) continue;
        if (!isEligibleFallback(m)) {
            logger.warn('Ignoring Gemini fallback model: not a free text model', { model: m });
            continue;
        }
        out.push(m);
    }
    return out;
};

// A resting model's rest: { until, reason }, or null once it is over.
const restOf = (model) => {
    const c = cooldowns.get(model);
    if (!c) return null;
    if (c.until <= Date.now()) {
        cooldowns.delete(model);
        return null;
    }
    return c;
};

// When a resting model may be used again (ms timestamp), or 0.
const coolingUntil = (model) => restOf(model)?.until || 0;

// Only quota and overload answers move generation on to another model. A
// bad request, a rejected key or permission, or a retired model (404) would
// fail the same way on every model, or means the configuration is wrong.
const isFallbackable = (err) => [429, 500, 503].includes(err?.upstream?.status);

const markUnavailable = (model, err) => {
    const { status, retryAfter } = err.upstream;
    const quota = status === 429;
    const ms = Math.min(MAX_COOLDOWN_MS, quota
        ? (retryAfter !== null && retryAfter !== undefined ? retryAfter * 1000 : env.GEMINI_QUOTA_COOLDOWN_MS)
        : env.GEMINI_OVERLOAD_COOLDOWN_MS);
    const reason = quota ? 'quota exceeded' : 'overloaded';
    cooldowns.set(model, { until: Date.now() + ms, reason });
    logger.warn('Gemini model resting', { model, status, reason, forMs: ms });
    return reason;
};

module.exports = {
    candidateModels, restOf, coolingUntil, isFallbackable, markUnavailable, isEligibleFallback,
    NOT_A_FREE_TEXT_MODEL, _cooldowns: cooldowns
};
