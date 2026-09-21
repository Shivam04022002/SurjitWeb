const env = require('../../config/env');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

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
// response.
const scrub = (text, apiKey) => {
    let out = String(text || '');
    if (apiKey) out = out.split(apiKey).join('[redacted]');
    return out.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[redacted]').slice(0, 300);
};

const upstreamError = (status, body, apiKey) => {
    const detail = scrub(body?.error?.message, apiKey);
    const reason = JSON.stringify(body?.error?.details || '');

    if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(`${reason} ${detail}`)) {
        return new AppError('The Gemini API key is not valid. Update it on the API page.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (status === 401 || status === 403) {
        return new AppError('The Gemini API key does not have permission to use this model.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (status === 404) {
        return new AppError('The configured Gemini model was not found. Check the model name on the API page.', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
    if (status === 429) {
        return new AppError('Gemini quota or rate limit reached. Please wait and try again.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }
    if (status >= 500) {
        return new AppError('Gemini is temporarily unavailable. Please try again shortly.', HTTP_STATUS.BAD_GATEWAY);
    }
    return new AppError(`Gemini rejected the request${detail ? `: ${detail}` : '.'}`, HTTP_STATUS.BAD_GATEWAY);
};

const request = async (apiKey, path, { method = 'GET', body, timeoutMs = env.GEMINI_TIMEOUT_MS } = {}) => {
    if (!apiKey) {
        throw new AppError('Gemini is not configured. Add an API key on the API page.', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: body ? JSON.stringify(body) : undefined,
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

    if (!res.ok) throw upstreamError(res.status, json, apiKey);
    return json || {};
};

// Confirms the key works and the model exists, without spending tokens.
const getModel = (apiKey, model) => {
    assertModel(model);
    return request(apiKey, `/models/${model}`, { timeoutMs: 15000 });
};

const generateContent = (apiKey, model, body) => {
    assertModel(model);
    return request(apiKey, `/models/${model}:generateContent`, { method: 'POST', body });
};

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
const generateJson = async (apiKey, model, { prompt, schema, temperature = 0.7 }) => {
    const json = await generateContent(apiKey, model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });
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

// Image generation. Returns { mimeType, data } with base64 data, or throws.
const generateImage = async (apiKey, model, { prompt }) => {
    const json = await generateContent(apiKey, model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9' }
        }
    });
    const candidate = assertUsable(json);
    const part = (candidate.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) {
        throw new AppError('The configured Gemini image model did not return an image.', HTTP_STATUS.BAD_GATEWAY);
    }
    return { mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data };
};

module.exports = { getModel, generateJson, generateImage, scrub, BASE_URL, MODEL_RX };
