const IntegrationSetting = require('../../models/IntegrationSetting');
const env = require('../../config/env');
const { encrypt, decrypt } = require('../../utils/secretBox');
const pexels = require('./pexels.service');
const logger = require('../../utils/logger');

// Pexels configuration: the key a Super Admin saves on the API page, stored
// the same way as the Gemini key — AES-256-GCM ciphertext in the
// integrationsettings collection, never selected by default, shown only as its
// last four characters.
//
// The key saved on the API page is used first. PEXELS_API_KEY in the server
// environment is the fallback, used only while no key is saved, so a server
// that already sets it keeps working.
//
// The raw key never leaves this module except as the argument to a Pexels
// request. Every value returned to a controller comes from publicStatus().

const PROVIDER = 'pexels';

const hintOf = (key) => (key ? key.slice(-4) : '');

const load = (withKey = false) => {
    const q = IntegrationSetting.findOne({ provider: PROVIDER });
    return withKey ? q.select('+encryptedKey') : q;
};

// { key, source } — source is 'database', 'environment' or 'none'. A saved key
// that no longer decrypts (the encryption secret changed) is skipped.
const resolve = async () => {
    const doc = await load(true);
    const saved = doc?.encryptedKey ? decrypt(doc.encryptedKey) : null;
    if (saved) return { key: saved, source: 'database', doc };
    if (env.PEXELS_API_KEY) return { key: env.PEXELS_API_KEY, source: 'environment', doc };
    return { key: null, source: 'none', doc };
};

const resolveApiKey = async () => (await resolve()).key;
const isConfigured = async () => !!(await resolveApiKey());

const publicStatus = async () => {
    const { key, source, doc } = await resolve();
    return {
        configured: !!key,
        source,
        keyHint: source === 'database' ? doc.keyHint : hintOf(key),
        // A saved key that can no longer be decrypted must be entered again.
        keyReadable: !(doc?.encryptedKey && source !== 'database'),
        environmentKey: !!env.PEXELS_API_KEY,
        lastTest: doc?.lastTest?.at ? doc.lastTest : null,
        updatedAt: doc?.updatedAt || null
    };
};

const saveKey = async (apiKey, userId) => {
    await IntegrationSetting.findOneAndUpdate(
        { provider: PROVIDER },
        {
            $set: {
                encryptedKey: encrypt(apiKey),
                keyHint: hintOf(apiKey),
                updatedBy: userId || null,
                // A new key invalidates the previous test result.
                lastTest: { at: null, ok: null, message: '' }
            },
            $setOnInsert: { provider: PROVIDER }
        },
        { upsert: true, runValidators: true }
    );
    // A rate-limit pause belonged to the previous key.
    pexels.clearRateLimit();
    logger.info('Pexels API key updated', { by: String(userId || '') });
    return publicStatus();
};

const removeKey = async (userId) => {
    await IntegrationSetting.updateOne(
        { provider: PROVIDER },
        { $set: { encryptedKey: null, keyHint: '', updatedBy: userId || null, lastTest: { at: null, ok: null, message: '' } } }
    );
    logger.info('Pexels API key removed', { by: String(userId || '') });
    return publicStatus();
};

const scrub = (text, key) => {
    const out = String(text || '');
    return (key ? out.split(key).join('[redacted]') : out).slice(0, 300);
};

// One small, uncached search with the key (a typed candidate, or the one in
// use). Only a test of the configuration in use is recorded.
const testConnection = async ({ apiKey: candidate } = {}) => {
    const { key: current, source } = await resolve();
    const key = candidate || current;

    let result;
    if (!key) {
        result = { ok: false, configured: false, message: 'Not configured: no Pexels API key is saved. Featured images must be uploaded.' };
    } else {
        try {
            await pexels.verify(key);
            result = { ok: true, configured: true, message: 'Connected. Pexels search verified.' };
        } catch (err) {
            result = { ok: false, configured: true, message: scrub(err.message, key) };
        }
    }

    if (!candidate && source === 'database') {
        await IntegrationSetting.updateOne(
            { provider: PROVIDER },
            { $set: { lastTest: { at: new Date(), ok: result.ok, message: result.message } } }
        );
    }
    return { ...result, testedAt: new Date(), candidate: !!candidate, source: candidate ? 'candidate' : source };
};

module.exports = { resolveApiKey, isConfigured, publicStatus, saveKey, removeKey, testConnection, PROVIDER };
