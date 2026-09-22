const env = require('../../config/env');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');
const logger = require('../../utils/logger');

// Minimal client for the Gemini REST API (Generative Language API, v1beta).
// Plain fetch rather than an SDK: three calls are needed, and this keeps the
// exact request — and where the key goes — visible in one place.
//
// The key travels only in the x-goog-api-key header, never in the URL, so it
// cannot end up in an access log, a proxy log or an error message that quotes
// the request URL.
//
// Upstream failures never map to 401/403: the CMS treats a 401 as an expired
// admin session and would try to refresh the login. They surface as
// 422/429/502/503/504 with a message safe to show an admin.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Model ids are interpolated into the URL path, so only the characters a
// Gemini model id actually uses are accepted.
const MODEL_RX = /^[a-z0-9][a-z0-9.\-]{1,99}$/;

const assertModel = (model) => {
    if (!MODEL_RX.test(String(model || ''))) {
        throw new AppError('The configured Gemini model name is invalid', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
};

// Belt and braces: nothing Google sends back is expected to contain the key,
// but any message that did would be scrubbed before it reaches a log or a
// response — the exact key, and anything shaped like a Google key in either
// the classic "AIza…" or the newer "AQ.…" format.
const scrub = (text, apiKey) => {
    let out = String(text || '');
    if (apiKey) out = out.split(apiKey).join('[redacted]');
    return out
        .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[redacted]')
        .replace(/AQ\.[\x21-\x7E]{10,}/g, '[redacted]')
        .slice(0, 300);
};

// Google's machine-readable reason (ErrorInfo.reason, e.g. API_KEY_INVALID,
// SERVICE_DISABLED). A fixed vocabulary that never contains the key, so it is
// safe to show and tells an admin what to fix.
const reasonOf = (body) => {
    const info = (body?.error?.details || []).find((d) => d && typeof d.reason === 'string');
    return info && /^[A-Z_]{3,64}$/.test(info.reason) ? info.reason : '';
};

// How long Google asks us to wait, in whole seconds, or null. Read from the
// RetryInfo detail ("retryDelay": "37s") or a Retry-After header (seconds or
// an HTTP date). Only a plain number ever reaches a message.
const retryDelayOf = (body, headers) => {
    const info = (body?.error?.details || []).find((d) => d && typeof d.retryDelay === 'string');
    const fromBody = info && /^(\d+(?:\.\d+)?)s$/.exec(info.retryDelay);
    if (fromBody) return Math.ceil(Number(fromBody[1]));
    const header = headers && typeof headers.get === 'function' ? headers.get('retry-after') : null;
    if (header && /^\d+$/.test(header.trim())) return Number(header.trim());
    if (header) {
        const at = Date.parse(header);
        if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - Date.now()) / 1000));
    }
    return null;
};

// Google's explanation is passed on, scrubbed of the key: for a model, quota
// or overload problem it is the only place that says what to do (which model
// replaces a retired one, when a quota resets), and a generic message hides it.
const describeUpstream = (status, body, apiKey, model, { retryAfter = null, attempts = 1 } = {}) => {
    const detail = scrub(body?.error?.message, apiKey);
    const reason = reasonOf(body);
    const googleStatus = /^[A-Z_]{3,40}$/.test(body?.error?.status || '') ? body.error.status : '';
    const code = ` (Google: ${reason || googleStatus || `HTTP ${status}`})`;
    const says = detail ? ` Google says: "${detail}"` : '';
    const named = model ? `"${model}" ` : '';

    // 400 API_KEY_INVALID is Google's answer to a key it does not recognise;
    // 401 UNAUTHENTICATED is the same verdict from the auth layer.
    if ((status === 400 && /API_KEY_INVALID|API key not valid/i.test(`${reason} ${detail}`)) || status === 401) {
        return new AppError(`The Gemini API key is not valid${code}. Paste the complete key on the API page.`, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (status === 403) {
        const hint = reason === 'SERVICE_DISABLED'
            ? ' The Generative Language API is not enabled for this key\'s Google project.'
            : reason === 'API_KEY_SERVICE_BLOCKED' || reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || reason === 'API_KEY_IP_ADDRESS_BLOCKED'
                ? ' The key\'s restrictions in Google Cloud do not allow this server to use the Gemini API.'
                : '';
        return new AppError(`Google refused this key for the Gemini API${code}.${hint}`, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    // A 404 covers a mistyped model name and also a real model this key may no
    // longer use (Google retires models for new users while still listing
    // them), so Google's own words decide which it is.
    if (status === 404) {
        return new AppError(
            `The Gemini model ${named}is not available for generation${code}.${says} Change the model on the API page.`,
            HTTP_STATUS.UNPROCESSABLE_ENTITY
        );
    }
    const wait = retryAfter !== null ? ` Google suggests retrying in ${retryAfter}s.` : '';
    // Quota errors stay quota errors: never retried here and never reworded as
    // an outage. The CMS pauses a bulk run on 429 and resumes on request.
    if (status === 429) {
        const quota = reason === 'RATE_LIMIT_EXCEEDED' ? false : /quota|billing|RESOURCE_EXHAUSTED/i.test(`${googleStatus} ${detail}`);
        return new AppError(
            quota
                ? `Gemini quota exceeded for ${model ? `"${model}"` : 'this model'}${code}.${says}${wait}`
                : `Gemini rate limit reached${code}.${wait || ' Please wait and try again.'}`,
            HTTP_STATUS.TOO_MANY_REQUESTS
        );
    }
    if (status >= 500) {
        const tries = attempts > 1 ? ` after ${attempts} attempts` : '';
        return new AppError(
            `Gemini is temporarily unavailable${code}${tries}.${says}${wait} Please try again shortly.`,
            HTTP_STATUS.BAD_GATEWAY
        );
    }
    return new AppError(`Gemini rejected the request${detail ? `: ${detail}` : '.'}`, HTTP_STATUS.BAD_GATEWAY);
};

// The admin-facing error, plus machine-readable facts about Google's answer
// (never the key or the body) so callers decide on fallback by status, not by
// parsing message text.
const upstreamError = (status, body, apiKey, model, opts = {}) => {
    const err = describeUpstream(status, body, apiKey, model, opts);
    err.upstream = {
        status,
        googleStatus: /^[A-Z_]{3,40}$/.test(body?.error?.status || '') ? body.error.status : '',
        retryAfter: opts.retryAfter ?? null,
        attempts: opts.attempts || 1,
        model: model || ''
    };
    return err;
};

// Transient upstream failures — Google overloaded (503) or erroring (500) —
// are retried here, inside one call, before any response is used. Nothing
// else runs until this returns, so a retry can never save a draft or store an
// image twice. Everything else (400/401/403/404, 429 quota, timeouts) fails
// at once: retrying would not change the answer, or would spend quota.
const RETRYABLE = new Set([500, 503]);
const MAX_RETRIES = 2;
// A retry is only started if at least this much of the budget would remain.
const MIN_ATTEMPT_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Short exponential backoff with jitter: ~1s, then ~2s (GEMINI_RETRY_BASE_MS
// sets the base). A delay Google asks for is honoured when it is longer.
const backoffMs = (retry, retryAfter) => {
    const base = env.GEMINI_RETRY_BASE_MS * 2 ** retry;
    const jitter = Math.floor(Math.random() * Math.min(250, env.GEMINI_RETRY_BASE_MS));
    return Math.max(base + jitter, retryAfter !== null ? retryAfter * 1000 : 0);
};

const request = async (apiKey, path, { method = 'GET', body, timeoutMs = env.GEMINI_TIMEOUT_MS, model } = {}) => {
    if (!apiKey) {
        throw new AppError('Gemini is not configured. Add an API key on the API page.', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // One budget for the whole call, retries included, so the request still
    // finishes inside the nginx proxy timeout.
    const deadline = Date.now() + timeoutMs;
    const payload = body ? JSON.stringify(body) : undefined;

    for (let attempt = 1; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));

        let res;
        try {
            res = await fetch(`${BASE_URL}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: payload,
                signal: controller.signal
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new AppError('Gemini took too long to respond. Please try again.', HTTP_STATUS.GATEWAY_TIMEOUT);
            }
            throw new AppError('Could not reach Gemini. Check the server\'s internet connection.', HTTP_STATUS.BAD_GATEWAY);
        } finally {
            clearTimeout(timer);
        }

        let json = null;
        try {
            json = await res.json();
        } catch {
            json = null;
        }
        if (res.ok) return json || {};

        const retryAfter = retryDelayOf(json, res.headers);
        if (RETRYABLE.has(res.status) && attempt <= MAX_RETRIES) {
            const delay = backoffMs(attempt - 1, retryAfter);
            if (Date.now() + delay + MIN_ATTEMPT_MS <= deadline) {
                // Safe metadata only: never the key, the prompt or the body.
                logger.warn('Gemini transient error, retrying', {
                    model: model || '',
                    method,
                    status: res.status,
                    googleStatus: /^[A-Z_]{3,40}$/.test(json?.error?.status || '') ? json.error.status : '',
                    attempt,
                    retryInMs: delay
                });
                await sleep(delay);
                continue;
            }
        }
        throw upstreamError(res.status, json, apiKey, model, { retryAfter, attempts: attempt });
    }
};

// Looks the model up without spending tokens. A successful lookup does NOT
// prove the key may generate with it: Google keeps retired models listed.
const getModel = (apiKey, model) => {
    assertModel(model);
    return request(apiKey, `/models/${model}`, { timeoutMs: 15000, model });
};

const generateContent = (apiKey, model, body, { timeoutMs } = {}) => {
    assertModel(model);
    return request(apiKey, `/models/${model}:generateContent`, { method: 'POST', body, model, ...(timeoutMs ? { timeoutMs } : {}) });
};

// The smallest real generation request: the same method and path blog
// generation uses, a few output tokens, so Test Connection proves the key can
// actually generate with the model rather than merely see it.
const probeGeneration = (apiKey, model) => generateContent(apiKey, model, {
    contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }],
    generationConfig: { maxOutputTokens: 16, temperature: 0 }
}, { timeoutMs: 20000 });

// A response Gemini blocked or cut short has no usable content; say why.
const assertUsable = (json) => {
    const blocked = json?.promptFeedback?.blockReason;
    if (blocked) {
        throw new AppError('Gemini declined this topic under its safety policy. Try rephrasing it.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    const candidate = json?.candidates?.[0];
    if (!candidate) {
        throw new AppError('Gemini returned no content. Please try again.', HTTP_STATUS.BAD_GATEWAY);
    }
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
        throw new AppError('Gemini declined this topic under its safety policy. Try rephrasing it.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    return candidate;
};

// Structured JSON generation against a response schema.
// `timeoutMs` is the time left in the caller's overall budget, so trying
// another model after a failure still ends inside the nginx proxy timeout.
const generateJson = async (apiKey, model, { prompt, schema, temperature = 0.7, timeoutMs }) => {
    const json = await generateContent(apiKey, model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    }, { timeoutMs });
    const candidate = assertUsable(json);
    if (candidate.finishReason === 'MAX_TOKENS') {
        throw new AppError('Gemini stopped before finishing the blog. Try a narrower topic.', HTTP_STATUS.BAD_GATEWAY);
    }
    const text = (candidate.content?.parts || []).map((p) => p.text || '').join('');
    try {
        return JSON.parse(text);
    } catch {
        throw new AppError('Gemini returned a malformed response. Please try again.', HTTP_STATUS.BAD_GATEWAY);
    }
};

// There is deliberately no image generation here: Gemini image models are
// paid on this account, and featured images come from Pexels instead.

module.exports = { getModel, probeGeneration, generateJson, scrub, BASE_URL, MODEL_RX, MAX_RETRIES };
