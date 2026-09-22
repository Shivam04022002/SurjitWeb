const mongoose = require('mongoose');

const PROVIDERS = ['gemini', 'pexels'];

// Server-side configuration for a third-party API the CMS calls. One document
// per provider. The model and image fields are Gemini's; a Pexels document
// uses only the key, its hint and the last test.
//
// The API key is stored only as AES-256-GCM ciphertext (utils/secretBox) and
// is excluded from every query by default (`select: false`), so a document
// fetched for display can never carry it. What the CMS shows instead is
// `keyHint` — the last four characters — so an admin can tell which key is
// configured without the key itself ever leaving the server.
const integrationSettingSchema = new mongoose.Schema({
    provider: {
        type: String,
        enum: PROVIDERS,
        required: true,
        unique: true
    },
    encryptedKey: {
        type: {
            _id: false,
            iv: String,
            tag: String,
            data: String
        },
        default: null,
        select: false
    },
    keyHint: { type: String, default: '', maxlength: 8 },
    textModel: { type: String, trim: true, default: '', maxlength: 100 },
    imageModel: { type: String, trim: true, default: '', maxlength: 100 },
    imageGenerationEnabled: { type: Boolean, default: true },
    // Gemini: when AI image generation fails, use a Pexels photo (with the
    // logo) if a Pexels key is set. Unset means on.
    pexelsFallbackEnabled: { type: Boolean, default: undefined },
    // Gemini: free text models tried after textModel on quota or overload
    // errors. Unset (no default) means none saved here, so the server
    // environment's GEMINI_FALLBACK_TEXT_MODELS applies.
    fallbackTextModels: { type: [{ type: String, trim: true, maxlength: 100 }], default: undefined },
    lastTest: {
        _id: false,
        at: { type: Date, default: null },
        ok: { type: Boolean, default: null },
        message: { type: String, default: '', maxlength: 500 }
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('IntegrationSetting', integrationSettingSchema);
module.exports.PROVIDERS = PROVIDERS;
