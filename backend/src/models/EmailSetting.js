const mongoose = require('mongoose');

// The CMS's outgoing-email configuration, set on the Email Settings page. One
// document, found by `key`.
//
// The Microsoft client secret is stored only as AES-256-GCM ciphertext
// (utils/secretBox) and is excluded from every query by default
// (`select: false`), so a document fetched for display can never carry it.
// What the CMS shows instead is `clientSecretHint` — the last four characters
// — so an admin can tell a secret is configured without it leaving the server.
const SINGLETON_KEY = 'default';

const PROVIDERS = ['microsoft365', 'outlook', 'exchange'];
const AUTH_METHODS = ['graph', 'smtp_oauth', 'smtp_basic'];

const emailSettingSchema = new mongoose.Schema({
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },
    provider: { type: String, enum: PROVIDERS, required: true },
    authMethod: { type: String, enum: AUTH_METHODS, required: true },
    senderName: { type: String, trim: true, default: '', maxlength: 100 },
    senderEmail: { type: String, trim: true, lowercase: true, required: true, maxlength: 254 },
    // Microsoft Entra app registration. Identifiers, not secrets.
    tenantId: { type: String, trim: true, default: '', maxlength: 253 },
    clientId: { type: String, trim: true, default: '', maxlength: 36 },
    encryptedClientSecret: {
        type: {
            _id: false,
            iv: String,
            tag: String,
            data: String
        },
        default: null,
        select: false
    },
    clientSecretHint: { type: String, default: '', maxlength: 8 },
    primaryRecipient: { type: String, trim: true, lowercase: true, required: true, maxlength: 254 },
    additionalRecipients: {
        type: [{ type: String, trim: true, lowercase: true, maxlength: 254 }],
        default: [],
        validate: { validator: (v) => v.length <= 10, message: 'At most 10 additional recipients' }
    },
    // Saved now; acted on when loan-application emails are connected.
    notifyNewLoanApplication: { type: Boolean, default: true },
    // The most recent Test Connection or Send Test Email, whichever was last.
    lastTest: {
        _id: false,
        at: { type: Date, default: null },
        kind: { type: String, enum: ['connection', 'email', null], default: null },
        ok: { type: Boolean, default: null },
        code: { type: String, default: '', maxlength: 60 },
        message: { type: String, default: '', maxlength: 500 }
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailSetting', emailSettingSchema);
module.exports.SINGLETON_KEY = SINGLETON_KEY;
module.exports.PROVIDERS = PROVIDERS;
module.exports.AUTH_METHODS = AUTH_METHODS;
