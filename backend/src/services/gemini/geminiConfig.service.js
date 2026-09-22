const IntegrationSetting = require('../../models/IntegrationSetting');
const env = require('../../config/env');
const { encrypt, decrypt } = require('../../utils/secretBox');
const gemini = require('./geminiClient');
const logger = require('../../utils/logger');

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

const effectiveModels = (doc) => ({
    textModel: doc?.textModel || env.GEMINI_TEXT_MODEL,
    imageModel: doc?.imageModel || env.GEMINI_IMAGE_MODEL,
    imageGenerationEnabled: doc ? doc.imageGenerationEnabled !== false : true
});

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
        defaults: { textModel: env.GEMINI_TEXT_MODEL, imageModel: env.GEMINI_IMAGE_MODEL },
        lastTest: doc?.lastTest?.at ? doc.lastTest : null,
        updatedAt: doc?.updatedAt || null
    };
};

// Only fields present in `input` change. An empty or absent apiKey keeps the
// stored key, so updating a model name never requires re-entering the key.
const saveConfig = async (input, userId) => {
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

// Checks the key against the configured models. The text model gets a real,
// minimal generation request — the same call blog generation makes — because
// a model lookup alone passes for models Google has retired for new users.
// The image model is only looked up (generating an image costs quota), and
// only once the text check has passed, so a bad key fails on one request and
// the message says which check failed. A candidate key (typed but
// not yet saved) can be tested; only a test of the saved configuration is
// recorded.
const testConnection = async ({ apiKey: candidate } = {}) => {
    const doc = await load();
    const models = effectiveModels(doc);
    const apiKey = candidate || await resolveApiKey();

    const checks = [{ label: 'Text model', model: models.textModel, run: gemini.probeGeneration, verified: 'generation verified' }];
    if (models.imageGenerationEnabled) {
        checks.push({ label: 'Image model', model: models.imageModel, run: gemini.getModel, verified: 'found' });
    }

    let result;
    if (!apiKey) {
        result = { ok: false, message: 'No API key is configured.' };
    } else {
        const passed = [];
        let failure = null;
        for (const c of checks) {
            try {
                await c.run(apiKey, c.model);
                passed.push(c);
            } catch (err) {
                failure = { check: c, message: gemini.scrub(err.message, apiKey) };
                break;
            }
        }
        result = failure
            ? { ok: false, message: `${failure.check.label} (${failure.check.model}): ${failure.message}`, failedCheck: failure.check.label }
            : { ok: true, message: `Connected. ${passed.map((c) => `${c.label}: ${c.model} (${c.verified})`).join(' · ')}` };
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
        imageGenerationEnabled: s.imageGenerationEnabled,
        textModel: s.textModel,
        imageModel: s.imageModel
    };
};

const getRuntimeConfig = async () => {
    const doc = await load();
    return { apiKey: await resolveApiKey(), ...effectiveModels(doc) };
};

module.exports = { publicStatus, saveConfig, removeKey, testConnection, availability, getRuntimeConfig };
