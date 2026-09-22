const env = require('../../config/env');
const logger = require('../../utils/logger');
const { MODEL_RX } = require('./geminiClient');

// Which Gemini text models blog generation may use, and which are resting.
//
// The API-page model is always tried first. After it come the free models a
// Super Admin saved on the API page or, while none are saved there, the ones
// an operator lists in GEMINI_FALLBACK_TEXT_MODELS. Nothing is hardcoded, so
// no model the account would pay for is ever chosen automatically. Image,
// video, audio and embedding models are never valid fallbacks, whatever the
// list says.
//
// A model that answers 429 (quota) rests for as long as Google asks, or
// GEMINI_QUOTA_COOLDOWN_MS; one still overloaded after the client's retries
// (500/503) rests for GEMINI_OVERLOAD_COOLDOWN_MS. Resting models are skipped
// rather than called, so a spent quota is not hit again and again. PM2 runs
// one process, so in-memory state is the whole picture.

const NOT_A_FREE_TEXT_MODEL = /(image|imagen|veo|tts|audio|live|embedding|aqa|computer-use)/i;
const MAX_COOLDOWN_MS = 60 * 60 * 1000;
// Each fallback needs its own share of the one request budget, so a long
// list could never be used anyway.
const MAX_FALLBACKS = 5;

const cooldowns = new Map();

const environmentList = () => String(env.GEMINI_FALLBACK_TEXT_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

// The fallback list in force, and where it comes from: the list saved on the
// API page, else GEMINI_FALLBACK_TEXT_MODELS, else none.
const resolveFallbacks = (saved) => {
    if (Array.isArray(saved) && saved.length) return { models: [...saved], source: 'saved' };
    const fromEnv = environmentList();
    if (fromEnv.length) return { models: fromEnv, source: 'environment' };
    return { models: [], source: 'none' };
};

const isEligibleFallback = (model) => MODEL_RX.test(model) && !NOT_A_FREE_TEXT_MODEL.test(model);

// Checks a list a Super Admin wants to save. Every entry is trimmed; blank
// entries (a trailing comma) are dropped. Anything else that is not allowed
// refuses the whole list — nothing is added, reordered or silently removed.
// Returns { models } or { errors } in the shape the validate middleware uses.
const validateFallbackList = (input, primary) => {
    const fail = (message) => ({ errors: [{ field: 'models', message }] });
    if (!Array.isArray(input)) return fail('Fallback models must be a list of model names');
    if (input.some((m) => typeof m !== 'string')) return fail('Each fallback model must be a model name');
    const models = input.map((m) => m.trim()).filter(Boolean);
    if (!models.length) return fail('Enter at least one fallback model, or clear the list instead');
    if (models.length > MAX_FALLBACKS) return fail(`At most ${MAX_FALLBACKS} fallback models can be used`);
    // Names are echoed only when they are plain model names.
    const shown = (m, i) => (MODEL_RX.test(m) ? `"${m}"` : `Entry ${i + 1}`);
    const seen = new Set();
    for (const [i, m] of models.entries()) {
        if (!MODEL_RX.test(m)) return fail(`${shown(m, i)} is not a valid Gemini model name`);
        if (NOT_A_FREE_TEXT_MODEL.test(m)) return fail(`${shown(m, i)} is not a text model. Image, video, audio, live, embedding, AQA and computer-use models cannot be fallbacks`);
        if (primary && m.toLowerCase() === String(primary).toLowerCase()) return fail(`${shown(m, i)} is the primary text model; list only other models`);
        if (seen.has(m.toLowerCase())) return fail(`${shown(m, i)} is listed more than once`);
        seen.add(m.toLowerCase());
    }
    return { models };
};

// The API-page model, then the eligible fallbacks in force, without repeats.
// `fallbacks` is the resolved list (resolveFallbacks); without it, the
// environment list is used, as before the API page could hold one.
const candidateModels = (primary, fallbacks = environmentList()) => {
    const out = [primary];
    for (const m of fallbacks) {
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
    candidateModels, resolveFallbacks, validateFallbackList, restOf, coolingUntil, isFallbackable,
    markUnavailable, isEligibleFallback, NOT_A_FREE_TEXT_MODEL, MAX_FALLBACKS, _cooldowns: cooldowns
};
