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
    // The provider credentials (set on the API page) and the recipients (set
    // on Email Settings) are saved separately, so neither half is required for
    // the document to exist. Only Microsoft 365 through Graph can be saved.
    provider: { type: String, enum: PROVIDERS, default: 'microsoft365' },
    authMethod: { type: String, enum: AUTH_METHODS, default: 'graph' },
    senderName: { type: String, trim: true, default: '', maxlength: 100 },
    senderEmail: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
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
    primaryRecipient: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
    additionalRecipients: {
        type: [{ type: String, trim: true, lowercase: true, maxlength: 254 }],
        default: [],
        validate: { validator: (v) => v.length <= 10, message: 'At most 10 additional recipients' }
    },
    // Saved now; acted on when loan-application emails are connected.
    notifyNewLoanApplication: { type: Boolean, default: true },
    // Which loan products each additional recipient is emailed about. The
    // primary recipient is not listed: it receives every application.
    //
    //   productIds    emailed only about applications for these products
    //   allProducts   emailed about every application, as before assignments
    //                 existed
    //
    // An additional recipient with no entry here was added before assignments
    // existed and keeps receiving every application (allProducts) until an
    // administrator assigns it products. One added on the page starts with an
    // entry and no products. Matched against the product saved on the
    // application, never against anything the applicant's browser sent.
    recipientProducts: {
        type: [{
            _id: false,
            email: { type: String, trim: true, lowercase: true, maxlength: 254 },
            allProducts: { type: Boolean, default: false },
            productIds: {
                type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
                default: [],
                validate: { validator: (v) => v.length <= 100, message: 'At most 100 products per recipient' }
            }
        }],
        default: [],
        validate: { validator: (v) => v.length <= 10, message: 'At most 10 recipient assignments' }
    },
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
