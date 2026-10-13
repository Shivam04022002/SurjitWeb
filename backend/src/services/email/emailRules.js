// What the server accepts as email configuration. The Email Settings page
// applies the same rules first (admin/src/pages/integrations/emailSettings.js),
// but this is the check that counts.

// Only Microsoft 365 through Microsoft Graph has a working sign-in and send
// path. The page shows the other providers and methods as not yet available,
// and the server refuses them rather than store a configuration nothing can
// use.
const SUPPORTED = [{ provider: 'microsoft365', authMethod: 'graph' }];

const PROVIDER_LABELS = {
    microsoft365: 'Microsoft 365 Business Email',
    outlook: 'Outlook Personal',
    exchange: 'Organization-managed Exchange'
};

const AUTH_METHOD_LABELS = {
    graph: 'Microsoft Graph API',
    smtp_oauth: 'SMTP with Microsoft OAuth 2.0',
    smtp_basic: 'SMTP with username and password'
};

const isSupported = (provider, authMethod) => SUPPORTED.some((s) => s.provider === provider && s.authMethod === authMethod);

const unsupportedMessage = (provider, authMethod) => {
    if (provider !== 'microsoft365') {
        return `${PROVIDER_LABELS[provider] || 'This provider'} is not available yet. Only Microsoft 365 Business Email can send mail at the moment.`;
    }
    return `${AUTH_METHOD_LABELS[authMethod] || 'This method'} is not available yet. Microsoft 365 sends through the Microsoft Graph API.`;
};

const MAX_ADDITIONAL_RECIPIENTS = 10;

// Deliberately the same plain rule as the page: one @, no spaces or control
// characters, a dot in the domain.
const EMAIL_RX = /^[^\s@\x00-\x1F\x7F]+@[^\s@\x00-\x1F\x7F]+\.[^\s@\x00-\x1F\x7F]+$/;
const isEmail = (v) => typeof v === 'string' && v.trim().length <= 254 && EMAIL_RX.test(v.trim());
const normaliseEmail = (v) => String(v ?? '').trim().toLowerCase();

const GUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RX = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
// The client-credentials flow signs in to one specific tenant; the shared
// authorities (common, organizations, consumers) cannot issue app-only tokens.
const isTenantId = (v) => typeof v === 'string' && (GUID_RX.test(v.trim()) || DOMAIN_RX.test(v.trim()));
const isGuid = (v) => typeof v === 'string' && GUID_RX.test(v.trim());

// Entra client secrets are 40-odd visible ASCII characters (letters, digits
// and ~ . _ -). The rule refuses only what cannot be a secret: whitespace,
// control characters and non-ASCII. Messages never echo the value.
const SECRET_RX = /^[\x21-\x7E]{8,512}$/;

module.exports = {
    SUPPORTED,
    PROVIDER_LABELS,
    AUTH_METHOD_LABELS,
    isSupported,
    unsupportedMessage,
    MAX_ADDITIONAL_RECIPIENTS,
    isEmail,
    normaliseEmail,
    isTenantId,
    isGuid,
    SECRET_RX
};
