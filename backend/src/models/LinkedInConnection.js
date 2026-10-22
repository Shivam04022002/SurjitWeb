const mongoose = require('mongoose');

// The CMS's authorization to post as the Surjit Finance LinkedIn Company Page.
// One document, found by `key`, written by the OAuth callback and cleared by
// Disconnect.
//
// Tokens are stored only as AES-256-GCM ciphertext (utils/secretBox) and are
// excluded from every query by default (`select: false`); the integration
// service selects them explicitly, decrypts them in memory and never returns
// them. The pending OAuth state is held as a SHA-256 hash for the same reason:
// what is in the database cannot be replayed at the callback.
const SINGLETON_KEY = 'default';

const secretBox = {
    type: {
        _id: false,
        iv: String,
        tag: String,
        data: String
    },
    default: null,
    select: false
};

const linkedInConnectionSchema = new mongoose.Schema({
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },

    // The LinkedIn app, as entered on the API Settings page. Each value is
    // used only while the matching LINKEDIN_* environment variable is unset
    // (services/linkedin/linkedinConfig.service). The client secret is
    // ciphertext, never selected by default, and never returned to the CMS —
    // only whether one is stored.
    config: {
        _id: false,
        clientId: { type: String, trim: true, default: '', maxlength: 64 },
        encryptedClientSecret: secretBox,
        organizationId: { type: String, trim: true, default: '', maxlength: 20 },
        apiVersion: { type: String, trim: true, default: '', maxlength: 6 },
        // Requests r_organization_admin so the member's page role can be
        // confirmed. Off only for an app LinkedIn has not granted it.
        verifyRole: { type: Boolean, default: true },
        updatedAt: { type: Date, default: null },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
    },

    encryptedAccessToken: secretBox,
    accessTokenExpiresAt: { type: Date, default: null },
    // Only present when LinkedIn grants the app programmatic refresh tokens.
    encryptedRefreshToken: secretBox,
    refreshTokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },

    // The page this connection was authorized for. If LINKEDIN_ORGANIZATION_ID
    // later changes, the connection no longer matches and must be renewed.
    organizationId: { type: String, default: '', maxlength: 30 },
    // The app (client ID) the tokens were issued to. LinkedIn tokens belong to
    // one app, so a different client ID means the connection must be renewed.
    connectedClientId: { type: String, default: '', maxlength: 64 },
    // From LinkedIn's organization access-control list, when the app may read
    // it (r_organization_admin): the member's approved role on the page.
    roleVerification: {
        _id: false,
        status: { type: String, enum: ['verified', 'not_verified'], default: 'not_verified' },
        role: { type: String, default: '', maxlength: 60 },
        memberUrn: { type: String, default: '', maxlength: 100 },
        checkedAt: { type: Date, default: null }
    },

    connectedAt: { type: Date, default: null },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    // Set when LinkedIn refuses the stored token (revoked, expired, refresh
    // rejected). Publishing stops until someone reconnects.
    reconnectRequired: {
        _id: false,
        code: { type: String, default: '', maxlength: 60 },
        at: { type: Date, default: null }
    },

    // The one OAuth attempt in flight, if any. Single use: the callback
    // consumes it atomically, and starting another attempt replaces it.
    pendingAuthorization: {
        type: {
            _id: false,
            stateHash: String,
            startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            expiresAt: Date
        },
        default: null,
        select: false
    },

    // The most recent Test Configuration: whether it reached LinkedIn
    // ("live") or only checked the settings ("readiness"), and its outcome.
    lastConfigTest: {
        _id: false,
        at: { type: Date, default: null },
        mode: { type: String, enum: ['readiness', 'live', null], default: null },
        outcome: { type: String, default: '', maxlength: 60 }
    },

    // The outcome of the most recent connection attempt, shown on the API page.
    lastAttempt: {
        _id: false,
        at: { type: Date, default: null },
        ok: { type: Boolean, default: null },
        code: { type: String, default: '', maxlength: 60 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('LinkedInConnection', linkedInConnectionSchema);
module.exports.SINGLETON_KEY = SINGLETON_KEY;
