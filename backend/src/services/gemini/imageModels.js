const env = require('../../config/env');

// Which Gemini model makes featured images. Separate from the text model and
// its fallbacks: there is exactly one image model and no image fallback model.
//
// Only current Gemini image models are used (generateContent with an IMAGE
// response). Older generations — gemini-2.5-flash-image and earlier — are
// never used: a setting saved with one (the previous default) reads as the
// current default instead, without rewriting the stored document.

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const IMAGE_MODEL_RX = /^gemini-[a-z0-9.-]*image[a-z0-9.-]*$/;
const LEGACY_IMAGE_MODEL_RX = /^gemini-[12]\./;

const DISPLAY_NAMES = { 'gemini-3.1-flash-image': 'Nano Banana 2' };

const isUsableImageModel = (model) => typeof model === 'string'
    && IMAGE_MODEL_RX.test(model) && !LEGACY_IMAGE_MODEL_RX.test(model);

const resolveImageModel = (stored) => {
    if (isUsableImageModel(stored)) return stored;
    if (isUsableImageModel(env.GEMINI_IMAGE_MODEL)) return env.GEMINI_IMAGE_MODEL;
    return DEFAULT_IMAGE_MODEL;
};

const displayName = (model) => DISPLAY_NAMES[model] || model;

module.exports = { DEFAULT_IMAGE_MODEL, isUsableImageModel, resolveImageModel, displayName, LEGACY_IMAGE_MODEL_RX };
