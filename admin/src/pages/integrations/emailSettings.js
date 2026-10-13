// The rules behind the Email Settings page: which providers it offers, what
// each one's SMTP endpoint is, and how the form is validated.
//
// Nothing here talks to the server or to browser storage. The server applies
// the same rules again (backend/src/services/email/emailRules.js) and is the
// authority. A client secret typed into the form lives only in page state
// until it is sent once with Save; the server never returns it.

export const MAX_ADDITIONAL_RECIPIENTS = 10

export const AUTH_METHODS = {
  SMTP_OAUTH: 'smtp_oauth',
  SMTP_BASIC: 'smtp_basic',
  GRAPH: 'graph'
}

export const AUTH_METHOD_LABELS = {
  [AUTH_METHODS.SMTP_OAUTH]: 'SMTP with Microsoft OAuth 2.0',
  [AUTH_METHODS.SMTP_BASIC]: 'SMTP with username and password',
  [AUTH_METHODS.GRAPH]: 'Microsoft Graph API (sendMail)'
}

// The combinations with a working sign-in and send path. Everything else is
// shown but marked as not available yet, and the server refuses to save it.
export const SUPPORTED = [{ provider: 'microsoft365', authMethod: AUTH_METHODS.GRAPH }]

export const isSupported = (provider, authMethod) => SUPPORTED.some((s) => s.provider === provider && s.authMethod === authMethod)
export const isProviderAvailable = (provider) => SUPPORTED.some((s) => s.provider === provider)

export const ENCRYPTION = {
  STARTTLS: 'starttls',
  SSL: 'ssl'
}

export const ENCRYPTION_LABELS = {
  [ENCRYPTION.STARTTLS]: 'STARTTLS',
  [ENCRYPTION.SSL]: 'SSL/TLS'
}

// Microsoft 365 and Outlook.com publish one SMTP endpoint each, so their host,
// port and encryption are fixed. An organization's own Exchange server has
// whatever endpoint its administrators gave it.
export const PROVIDERS = {
  microsoft365: {
    key: 'microsoft365',
    label: 'Microsoft 365 Business Email',
    description: 'A mailbox on your organization\'s Microsoft 365 (Exchange Online) tenant.',
    smtp: { host: 'smtp.office365.com', port: 587, encryption: ENCRYPTION.STARTTLS, editable: false },
    authMethods: [AUTH_METHODS.GRAPH, AUTH_METHODS.SMTP_OAUTH],
    defaultAuthMethod: AUTH_METHODS.GRAPH,
    fixedTenantId: null,
    note: 'Mail is sent through Microsoft Graph as the sender mailbox, signed in as your app registration in Microsoft Entra ID. Basic (password) authentication is not offered.'
  },
  outlook: {
    key: 'outlook',
    label: 'Outlook Personal',
    description: 'A personal Outlook.com, Hotmail or Live mailbox.',
    smtp: { host: 'smtp-mail.outlook.com', port: 587, encryption: ENCRYPTION.STARTTLS, editable: false },
    authMethods: [AUTH_METHODS.SMTP_OAUTH, AUTH_METHODS.GRAPH],
    defaultAuthMethod: AUTH_METHODS.SMTP_OAUTH,
    // Personal Microsoft accounts all sign in through the "consumers" tenant.
    fixedTenantId: 'consumers',
    note: 'Outlook.com no longer accepts password sign-in for SMTP. Personal accounts need OAuth 2.0 with a one-time interactive sign-in, and have lower daily sending limits than business mailboxes.'
  },
  exchange: {
    key: 'exchange',
    label: 'Organization-managed Exchange',
    description: 'An Exchange server run by your organization (on-premises or hybrid).',
    smtp: { host: '', port: 587, encryption: ENCRYPTION.STARTTLS, editable: true },
    authMethods: [AUTH_METHODS.SMTP_BASIC, AUTH_METHODS.SMTP_OAUTH],
    defaultAuthMethod: AUTH_METHODS.SMTP_BASIC,
    fixedTenantId: null,
    note: 'Ask your Exchange administrator for the SMTP host, port, encryption and which sign-in method the server accepts. OAuth 2.0 is only available on hybrid deployments with modern authentication.'
  }
}

export const PROVIDER_KEYS = Object.keys(PROVIDERS)

export const usesOAuth = (authMethod) => authMethod === AUTH_METHODS.SMTP_OAUTH || authMethod === AUTH_METHODS.GRAPH
export const usesSmtp = (authMethod) => authMethod === AUTH_METHODS.SMTP_OAUTH || authMethod === AUTH_METHODS.SMTP_BASIC

// What the page starts from. With no saved settings to load, this is also
// what Cancel returns to.
export const defaultEmailSettings = () => applyProvider({
  provider: 'microsoft365',
  senderName: '',
  senderEmail: '',
  smtpHost: '',
  smtpPort: '',
  encryption: ENCRYPTION.STARTTLS,
  smtpUsername: '',
  authMethod: AUTH_METHODS.GRAPH,
  tenantId: '',
  clientId: '',
  primaryRecipient: '',
  additionalRecipients: [],
  notifyNewLoanApplication: true,
  clientSecret: '',
  testRecipient: ''
}, 'microsoft365')

// Switching provider resets what the provider decides — the endpoint, and an
// auth method it does not support — and keeps everything the admin typed that
// still applies: sender, recipients, notifications.
export const applyProvider = (form, providerKey) => {
  const provider = PROVIDERS[providerKey]
  if (!provider) return form
  const keepHost = provider.smtp.editable && PROVIDERS[form.provider]?.smtp.editable
  return {
    ...form,
    provider: provider.key,
    smtpHost: keepHost ? form.smtpHost : provider.smtp.host,
    smtpPort: keepHost ? form.smtpPort : String(provider.smtp.port),
    encryption: keepHost ? form.encryption : provider.smtp.encryption,
    authMethod: provider.authMethods.includes(form.authMethod) ? form.authMethod : provider.defaultAuthMethod,
    tenantId: provider.fixedTenantId ?? (PROVIDERS[form.provider]?.fixedTenantId ? '' : form.tenantId)
  }
}

// Deliberately plain: one @, no spaces, a dot in the domain. The server will
// be the authority on what it accepts; this catches typing mistakes.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normaliseEmail = (value) => String(value ?? '').trim().toLowerCase()

export const isValidEmail = (value) => {
  const email = String(value ?? '').trim()
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email)
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
// A host name or an IPv4 address.
const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i

export const isGuid = (value) => GUID_PATTERN.test(String(value ?? '').trim())
// Microsoft's shared sign-in authorities, accepted in place of a tenant's own
// ID — "consumers" is how every personal Outlook.com account signs in.
const WELL_KNOWN_TENANTS = ['consumers', 'organizations', 'common']

export const isTenantId = (value) => {
  const v = String(value ?? '').trim()
  return isGuid(v) || DOMAIN_PATTERN.test(v) || WELL_KNOWN_TENANTS.includes(v.toLowerCase())
}
export const isHost = (value) => HOST_PATTERN.test(String(value ?? '').trim())

export const isPort = (value) => {
  const v = String(value ?? '').trim()
  if (!/^\d{1,5}$/.test(v)) return false
  const n = Number(v)
  return n >= 1 && n <= 65535
}

// Checks one address before it joins the additional recipients. Duplicates are
// compared case-insensitively, against the primary recipient as well as the
// list, because mail servers treat the domain — and in practice the whole
// address — without regard to case.
//
// `index` is the entry's own position when checking one already in the list:
// it is then compared only with the entries before it, so of two copies only
// the later one is reported.
export const recipientError = (candidate, { primaryRecipient = '', additionalRecipients = [] } = {}, index = -1) => {
  const email = normaliseEmail(candidate)
  if (!email) return 'Enter an email address'
  if (!isValidEmail(email)) return 'Enter a valid email address'
  if (email === normaliseEmail(primaryRecipient)) return 'This address is already the primary recipient'
  const others = index >= 0 ? additionalRecipients.slice(0, index) : additionalRecipients
  const duplicate = others.some((r) => normaliseEmail(r) === email)
  if (duplicate) return 'This address is already in the list'
  return ''
}

// Adds one address, or explains why it cannot be added. The list is returned
// unchanged on error so a caller can always assign the result.
export const addRecipient = (form, candidate) => {
  const list = form.additionalRecipients || []
  if (list.length >= MAX_ADDITIONAL_RECIPIENTS) {
    return { additionalRecipients: list, error: `You can add up to ${MAX_ADDITIONAL_RECIPIENTS} additional recipients` }
  }
  const error = recipientError(candidate, form)
  if (error) return { additionalRecipients: list, error }
  return { additionalRecipients: [...list, normaliseEmail(candidate)], error: '' }
}

export const removeRecipient = (list, index) => (list || []).filter((_, i) => i !== index)

// Same rule as the server: visible ASCII only, so a stray space or line break
// from a paste is caught here rather than by Microsoft.
const SECRET_PATTERN = /^[\x21-\x7E]{8,512}$/
// App-only (client-credentials) tokens are issued by one specific tenant, never
// by Microsoft's shared sign-in authorities.
const SHARED_AUTHORITIES = ['common', 'organizations', 'consumers']

export const unsupportedMessage = (providerKey, authMethod) => (isProviderAvailable(providerKey)
  ? `${AUTH_METHOD_LABELS[authMethod] || 'This method'} is not available yet. Microsoft 365 sends through the Microsoft Graph API.`
  : `${PROVIDERS[providerKey]?.label || 'This provider'} is not available yet. Only Microsoft 365 Business Email can send mail at the moment.`)

// Every field error for the form as it stands, keyed by field name. Additional
// recipients are reported per entry under `additionalRecipients.<index>`, so
// one bad address does not mark the whole list.
//
// `secretStored` says whether the server already holds a readable client
// secret; only then may the secret field be left blank.
export const validateEmailSettings = (form, { secretStored = false } = {}) => {
  const errors = {}
  const provider = PROVIDERS[form.provider]

  if (!provider) errors.provider = 'Choose an email provider'

  if (String(form.senderName || '').trim().length > 100) {
    errors.senderName = 'Sender name must not exceed 100 characters'
  } else if (/[\r\n]/.test(String(form.senderName || ''))) {
    errors.senderName = 'Sender name must not contain line breaks'
  }

  if (!String(form.senderEmail || '').trim()) errors.senderEmail = 'Sender email is required'
  else if (!isValidEmail(form.senderEmail)) errors.senderEmail = 'Enter a valid email address'

  if (provider && !provider.authMethods.includes(form.authMethod)) {
    errors.authMethod = 'Choose an authentication method this provider supports'
  } else if (provider && !isSupported(form.provider, form.authMethod)) {
    errors.authMethod = unsupportedMessage(form.provider, form.authMethod)
  }

  if (usesSmtp(form.authMethod)) {
    if (!String(form.smtpHost || '').trim()) errors.smtpHost = 'SMTP host is required'
    else if (!isHost(form.smtpHost)) errors.smtpHost = 'Enter a host name such as mail.example.com'

    if (!String(form.smtpPort ?? '').trim()) errors.smtpPort = 'Port is required'
    else if (!isPort(form.smtpPort)) errors.smtpPort = 'Enter a port between 1 and 65535'

    if (!Object.values(ENCRYPTION).includes(form.encryption)) errors.encryption = 'Choose an encryption method'

    if (!String(form.smtpUsername || '').trim()) errors.smtpUsername = 'SMTP username is required'
    else if (String(form.smtpUsername).trim().length > 254) errors.smtpUsername = 'SMTP username must not exceed 254 characters'
  }

  if (usesOAuth(form.authMethod)) {
    if (!String(form.tenantId || '').trim()) errors.tenantId = 'Tenant ID is required'
    else if (!isTenantId(form.tenantId)) errors.tenantId = 'Enter a directory (tenant) ID or a domain such as contoso.onmicrosoft.com'
    else if (form.authMethod === AUTH_METHODS.GRAPH && SHARED_AUTHORITIES.includes(String(form.tenantId).trim().toLowerCase())) {
      errors.tenantId = 'Enter your own directory (tenant) ID; shared sign-in names such as "common" cannot be used here'
    }

    if (!String(form.clientId || '').trim()) errors.clientId = 'Application (client) ID is required'
    else if (!isGuid(form.clientId)) errors.clientId = 'Enter the application (client) ID in the form 00000000-0000-0000-0000-000000000000'

    const secret = String(form.clientSecret || '').trim()
    if (secret && !SECRET_PATTERN.test(secret)) errors.clientSecret = 'Client secret must be 8-512 characters, with no spaces or line breaks'
    else if (!secret && !secretStored) errors.clientSecret = 'Client secret is required'
  }

  if (!String(form.primaryRecipient || '').trim()) errors.primaryRecipient = 'Primary recipient is required'
  else if (!isValidEmail(form.primaryRecipient)) errors.primaryRecipient = 'Enter a valid email address'

  const list = form.additionalRecipients || []
  if (list.length > MAX_ADDITIONAL_RECIPIENTS) {
    errors.additionalRecipients = `You can add up to ${MAX_ADDITIONAL_RECIPIENTS} additional recipients`
  }
  list.forEach((r, i) => {
    const error = recipientError(r, form, i)
    if (error) errors[`additionalRecipients.${i}`] = error
  })

  return errors
}

// The test recipient is checked on its own: it is not a setting, so it never
// stops a save, and it is required only for Send Test Email.
export const testRecipientError = (value, { required = false } = {}) => {
  const email = String(value || '').trim()
  if (!email) return required ? 'Enter the address to send the test email to' : ''
  return isValidEmail(email) ? '' : 'Enter a valid email address'
}

// The order fields appear on the page, so a failed save can move focus to the
// first problem a keyboard user would meet.
export const FIELD_ORDER = [
  'provider', 'senderName', 'senderEmail', 'authMethod',
  'smtpHost', 'smtpPort', 'encryption', 'smtpUsername',
  'tenantId', 'clientId', 'clientSecret',
  'primaryRecipient', 'additionalRecipients'
]

export const firstErrorField = (errors) => {
  const keys = Object.keys(errors || {})
  for (const field of FIELD_ORDER) {
    const match = keys.find((k) => k === field || k.startsWith(`${field}.`))
    if (match) return match
  }
  return keys[0] || null
}

// Whether the form differs from what it started as — trimmed, and with
// addresses compared case-insensitively, so retyping a value identically does
// not count as a change. The test recipient is not a setting, so typing one
// does not hold back Send Test Email; a typed client secret is a change.
const comparable = (input) => {
  const form = { ...input }
  delete form.testRecipient
  return {
  ...form,
  senderName: String(form.senderName || '').trim(),
  senderEmail: normaliseEmail(form.senderEmail),
  smtpHost: String(form.smtpHost || '').trim().toLowerCase(),
  smtpPort: String(form.smtpPort ?? '').trim(),
  smtpUsername: String(form.smtpUsername || '').trim(),
  tenantId: String(form.tenantId || '').trim().toLowerCase(),
  clientId: String(form.clientId || '').trim().toLowerCase(),
  primaryRecipient: normaliseEmail(form.primaryRecipient),
  additionalRecipients: (form.additionalRecipients || []).map(normaliseEmail),
  clientSecret: String(form.clientSecret || '').trim()
  }
}

export const isDirty = (form, baseline) => JSON.stringify(comparable(form)) !== JSON.stringify(comparable(baseline))

// What the app registration in Microsoft Entra needs for the chosen provider
// and method — shown beside the OAuth fields so the admin can set it up.
export const oauthPermissionHint = (providerKey, authMethod) => {
  if (!usesOAuth(authMethod)) return ''
  if (providerKey === 'microsoft365') {
    return authMethod === AUTH_METHODS.GRAPH
      ? 'Grant the application permission Mail.Send, scoped to the sender mailbox.'
      : 'Grant the application permission SMTP.SendAsApp, and register the app in Exchange Online with access to the sender mailbox.'
  }
  if (providerKey === 'outlook') {
    return authMethod === AUTH_METHODS.GRAPH
      ? 'Use the delegated permissions Mail.Send and offline_access. The mailbox owner signs in once to approve them.'
      : 'Use the delegated permissions SMTP.Send and offline_access. The mailbox owner signs in once to approve them.'
  }
  return 'Use the app registration your Exchange administrator set up for hybrid modern authentication.'
}

// ── Talking to the server ─────────────────────────────────────────────────────

// The form for a configuration the server returned: its saved settings, or
// the defaults when nothing is saved yet. The secret field always starts
// blank — the server never sends the secret back.
export const formFromConfig = (config) => {
  const base = defaultEmailSettings()
  const s = config?.settings
  if (!s) return base
  return {
    ...applyProvider({ ...base, provider: s.provider }, s.provider),
    authMethod: s.authMethod,
    senderName: s.senderName || '',
    senderEmail: s.senderEmail || '',
    tenantId: s.tenantId || '',
    clientId: s.clientId || '',
    primaryRecipient: s.primaryRecipient || '',
    additionalRecipients: [...(s.additionalRecipients || [])],
    notifyNewLoanApplication: s.notifyNewLoanApplication !== false,
    clientSecret: '',
    testRecipient: ''
  }
}

// What Save sends. A blank secret is left out, which the server reads as
// "keep the one stored"; SMTP fields are not sent because no SMTP method can
// be saved yet.
export const payloadFromForm = (form) => {
  const payload = {
    provider: form.provider,
    authMethod: form.authMethod,
    senderName: String(form.senderName || '').trim(),
    senderEmail: normaliseEmail(form.senderEmail),
    tenantId: String(form.tenantId || '').trim(),
    clientId: String(form.clientId || '').trim(),
    primaryRecipient: normaliseEmail(form.primaryRecipient),
    additionalRecipients: (form.additionalRecipients || []).map(normaliseEmail),
    notifyNewLoanApplication: !!form.notifyNewLoanApplication
  }
  const secret = String(form.clientSecret || '').trim()
  if (secret) payload.clientSecret = secret
  return payload
}

export const secretStoredIn = (config) => !!(config?.clientSecret?.configured && config.clientSecret.readable)

// Field errors from a 400, keyed like validateEmailSettings' errors.
export const serverFieldErrors = (err) => Object.fromEntries(
  (err?.response?.data?.errors || []).filter((e) => e.field).map((e) => [e.field, e.message])
)

// A request that did not complete, in words for the page.
export const requestErrorMessage = (err, fallback) => {
  const status = err?.response?.status
  const message = err?.response?.data?.message
  if (status === 401) return 'Your session has expired. Sign in again to continue.'
  if (status === 403) return 'Your role does not allow this. Changing email settings and sending tests need edit access to API Settings.'
  if (status === 429) return message || 'Too many tests in a short time. Try again later.'
  if (status === 400) return err?.response?.data?.errors?.[0]?.message || message || fallback
  if (status >= 500) return 'The server could not complete that. Try again in a moment.'
  if (!err?.response) return 'No response from the server. Check your connection and try again.'
  return message || fallback
}

// The status chip, from what the server last reported — never from the form.
export const connectionStatus = (config) => {
  if (!config?.saved) return { label: 'Not configured', color: 'default' }
  if (config.clientSecret?.configured && !config.clientSecret.readable) return { label: 'Client secret unreadable — enter it again', color: 'error' }
  if (!config.configured) return { label: 'Incomplete', color: 'warning' }
  const t = config.lastTest
  if (!t) return { label: 'Saved — not tested', color: 'default' }
  if (!t.ok) return { label: t.kind === 'email' ? 'Test email failed' : 'Connection failed', color: 'error' }
  return { label: t.kind === 'email' ? 'Test email accepted' : 'Connected', color: 'success' }
}
