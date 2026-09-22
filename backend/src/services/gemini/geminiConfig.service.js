const IntegrationSetting = require('../../models/IntegrationSetting');
const env = require('../../config/env');
const { encrypt, decrypt } = require('../../utils/secretBox');
const gemini = require('./geminiClient');
const textModels = require('./textModels');
const pexels = require('../images/pexels.service');
const pexelsConfig = require('../images/pexelsConfig.service');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// Gemini configuration: where the key comes from, which models are used, and
// the last connection test.
//
// The raw key never leaves this module except as the argument to a Gemini
// request. Every value returned to a controller comes from publicStatus(),
// which reports whether a key exists and its last four characters — never the
// key or its ciphertext.

const PROVIDER = 'gemini';

const hintOf = (key) => (key ? key.slice(-4) : '');

const load = (withKey = false) => {
    const q = IntegrationSetting.findOne({ provider: PROVIDER });
    return withKey ? q.select('+encryptedKey') : q;
};

// The key a Gemini call should use. The server environment wins over the CMS,
// so an operator can pin or rotate the key without touching the database.
const resolveApiKey = async () => {
    if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
    const doc = await load(true);
    return doc?.encryptedKey ? decrypt(doc.encryptedKey) : null;
};

// Free fallbacks tried after the text model: the list saved on the API page,
// else GEMINI_FALLBACK_TEXT_MODELS, else none (textModels.resolveFallbacks).
const effectiveModels = (doc) => {
    const textModel = doc?.textModel || env.GEMINI_TEXT_MODEL;
    const fallbacks = textModels.resolveFallbacks(doc?.fallbackTextModels);
    return {
        textModel,
        imageModel: doc?.imageModel || env.GEMINI_IMAGE_MODEL,
        imageGenerationEnabled: doc ? doc.imageGenerationEnabled !== false : true,
        textFallbacks: textModels.candidateModels(textModel, fallbacks.models).slice(1),
        fallbackSource: fallbacks.source
    };
};

const publicStatus = async () => {
    const doc = await load(true);
    const models = effectiveModels(doc);

    let source = 'none';
    let keyHint = '';
    let keyReadable = true;
    if (env.GEMINI_API_KEY) {
        source = 'environment';
        keyHint = hintOf(env.GEMINI_API_KEY);
    } else if (doc?.encryptedKey) {
        source = 'database';
        keyHint = doc.keyHint;
        // A stored key that no longer decrypts (the encryption secret changed)
        // is reported, so the admin knows to enter it again.
        keyReadable = decrypt(doc.encryptedKey) !== null;
    }

    return {
        configured: source !== 'none' && keyReadable,
        source,
        keyHint,
        keyReadable,
        ...models,
        // Featured images come from Pexels; only whether a key is set is shown.
        imageProvider: { name: 'pexels', configured: await pexelsConfig.isConfigured() },
        defaults: { textModel: env.GEMINI_TEXT_MODEL, imageModel: env.GEMINI_IMAGE_MODEL },
        lastTest: doc?.lastTest?.at ? doc.lastTest : null,
        updatedAt: doc?.updatedAt || null
    };
};

// Only fields present in `input` change. An empty or absent apiKey keeps the
// stored key, so updating a model name never requires re-entering the key.
const saveConfig = async (input, userId) => {
    // The primary model may not also be one of the saved fallbacks.
    if (input.textModel !== undefined) {
        const saved = (await load())?.fallbackTextModels || [];
        const primary = (input.textModel || env.GEMINI_TEXT_MODEL).toLowerCase();
        if (saved.some((m) => m.toLowerCase() === primary)) {
            throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
                { field: 'textModel', message: 'This model is in the free fallback list. Remove it there first, or choose another text model.' }
            ]);
        }
    }
    const update = { updatedBy: userId || null };
    if (input.textModel !== undefined) update.textModel = input.textModel;
    if (input.imageModel !== undefined) update.imageModel = input.imageModel;
    if (input.imageGenerationEnabled !== undefined) update.imageGenerationEnabled = input.imageGenerationEnabled;

    if (input.apiKey) {
        update.encryptedKey = encrypt(input.apiKey);
        update.keyHint = hintOf(input.apiKey);
        // A new key invalidates the previous test result.
        update.lastTest = { at: null, ok: null, message: '' };
    }

    await IntegrationSetting.findOneAndUpdate(
        { provider: PROVIDER },
        { $set: update, $setOnInsert: { provider: PROVIDER } },
        { upsert: true, runValidators: true }
    );
    logger.info('Gemini configuration updated', { by: String(userId || ''), keyChanged: !!input.apiKey });
    return publicStatus();
};

const removeKey = async (userId) => {
    await IntegrationSetting.updateOne(
        { provider: PROVIDER },
        { $set: { encryptedKey: null, keyHint: '', updatedBy: userId || null, lastTest: { at: null, ok: null, message: '' } } }
    );
    logger.info('Gemini API key removed', { by: String(userId || '') });
    return publicStatus();
};

// ── Free fallback models ───────────────────────────────────────────────────────
// Model names only: nothing here reads, returns or changes the API key.

const fallbackStatus = async () => {
    const models = effectiveModels(await load());
    return {
        models: models.textFallbacks,
        source: models.fallbackSource,
        primary: models.textModel,
        // What GEMINI_FALLBACK_TEXT_MODELS would give, shown while none are saved.
        environmentModels: textModels.candidateModels(models.textModel, textModels.resolveFallbacks(null).models).slice(1),
        maxModels: textModels.MAX_FALLBACKS
    };
};

const saveFallbacks = async (input, userId) => {
    const primary = effectiveModels(await load()).textModel;
    const { models, errors } = textModels.validateFallbackList(input, primary);
    if (errors) throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, errors);
    await IntegrationSetting.findOneAndUpdate(
        { provider: PROVIDER },
        { $set: { fallbackTextModels: models, updatedBy: userId || null }, $setOnInsert: { provider: PROVIDER } },
        { upsert: true, runValidators: true }
    );
    logger.info('Gemini fallback models updated', { by: String(userId || ''), models });
    return fallbackStatus();
};

// Removes the saved list; GEMINI_FALLBACK_TEXT_MODELS (if set) applies again.
const clearFallbacks = async (userId) => {
    await IntegrationSetting.updateOne(
        { provider: PROVIDER },
        { $unset: { fallbackTextModels: 1 }, $set: { updatedBy: userId || null } }
    );
    logger.info('Gemini fallback models cleared', { by: String(userId || '') });
    return fallbackStatus();
};

// Checks the key against the API-page text model with a real, minimal
// generation request — the same call blog generation makes — because a model
// lookup alone passes for models Google has retired for new users. Then, if
// automatic images are on, one small Pexels search proves that key; a missing
// Pexels key is reported but is not a failure (images can be uploaded). No
// Gemini image model is ever called. A candidate key (typed but not yet saved)
// can be tested; only a test of the saved configuration is recorded.
const testConnection = async ({ apiKey: candidate } = {}) => {
    const doc = await load();
    const models = effectiveModels(doc);
    const apiKey = candidate || await resolveApiKey();

    const checks = [{ label: 'Text model', model: models.textModel, run: (key) => gemini.probeGeneration(key, models.textModel), verified: 'generation verified' }];
    const notes = [];
    const pexelsKey = models.imageGenerationEnabled ? await pexelsConfig.resolveApiKey() : null;
    if (pexelsKey) {
        checks.push({ label: 'Images', model: 'Pexels', run: () => pexels.verify(pexelsKey), verified: 'search verified' });
    } else if (models.imageGenerationEnabled) {
        notes.push('Images: Pexels is not configured (add a Pexels key on the API page) — featured images must be uploaded.');
    }

    let result;
    if (!apiKey) {
        result = { ok: false, message: 'No API key is configured.' };
    } else {
        const passed = [];
        let failure = null;
        for (const c of checks) {
            try {
                await c.run(apiKey);
                passed.push(c);
            } catch (err) {
                failure = { check: c, message: gemini.scrub(gemini.scrub(err.message, apiKey), pexelsKey) };
                break;
            }
        }
        result = failure
            ? { ok: false, message: `${failure.check.label} (${failure.check.model}): ${failure.message}`, failedCheck: failure.check.label }
            : { ok: true, message: [`Connected. ${passed.map((c) => `${c.label}: ${c.model} (${c.verified})`).join(' · ')}`, ...notes].join(' ') };
    }

    if (!candidate && doc) {
        await IntegrationSetting.updateOne(
            { provider: PROVIDER },
            { $set: { lastTest: { at: new Date(), ok: result.ok, message: result.message } } }
        );
    }
    return { ...result, testedAt: new Date(), candidate: !!candidate, ...models };
};

// What the Gemini Blogs page needs to know, for any role allowed to generate.
const availability = async () => {
    const s = await publicStatus();
    return {
        configured: s.configured,
        // True only when automatic images can actually run: toggle on and a
        // Pexels key set. Otherwise the CMS asks for an uploaded image.
        imageGenerationEnabled: s.imageGenerationEnabled && s.imageProvider.configured,
        textModel: s.textModel,
        textFallbacks: s.textFallbacks,
        imageProvider: s.imageProvider
    };
};

const getRuntimeConfig = async () => {
    const doc = await load();
    return { apiKey: await resolveApiKey(), ...effectiveModels(doc) };
};

module.exports = {
    publicStatus, saveConfig, removeKey, testConnection, availability, getRuntimeConfig,
    fallbackStatus, saveFallbacks, clearFallbacks
};
