// The rules behind the two email forms:
//
//   Email API card (API page)   Microsoft 365 app credentials and sender
//   Email Settings page         notification recipients and preference
//
// Both edit halves of the one server-side configuration. Nothing here talks to
// the server or to browser storage; the server applies the same rules again
// (backend/src/services/email/emailRules.js) and is the authority. A typed
// client secret lives only in page state until it is sent once with Save; the
// server never returns it.

export const MAX_ADDITIONAL_RECIPIENTS = 10

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
// App-only (client-credentials) tokens are issued by one specific tenant, never
// by Microsoft's shared sign-in authorities.
const SHARED_AUTHORITIES = ['common', 'organizations', 'consumers']
// Same rule as the server: visible ASCII only, so a stray space or line break
// from a paste is caught here rather than by Microsoft.
const SECRET_PATTERN = /^[\x21-\x7E]{8,512}$/

export const isGuid = (value) => GUID_PATTERN.test(String(value ?? '').trim())
export const isTenantId = (value) => {
  const v = String(value ?? '').trim()
  return isGuid(v) || (DOMAIN_PATTERN.test(v) && !SHARED_AUTHORITIES.includes(v.toLowerCase()))
}

// ── Recipients (Email Settings) ───────────────────────────────────────────────

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
  if (others.some((r) => normaliseEmail(r) === email)) return 'This address is already in the list'
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

export const defaultRecipients = () => ({
  primaryRecipient: '',
  additionalRecipients: [],
  notifyNewLoanApplication: true,
  recipientProducts: {}
})

// Field errors keyed by field name. Additional recipients are reported per
// entry under `additionalRecipients.<index>`, so one bad address does not mark
// the whole list.
export const validateRecipients = (form) => {
  const errors = {}
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

export const recipientsFromConfig = (config) => {
  const s = config?.settings
  if (!s) return defaultRecipients()
  return {
    primaryRecipient: s.primaryRecipient || '',
    additionalRecipients: [...(s.additionalRecipients || [])],
    notifyNewLoanApplication: s.notifyNewLoanApplication !== false,
    recipientProducts: assignmentsFromConfig(config)
  }
}

// Assignments are sent for recipients added or changed on this page. One still
// emailed about every application from before assignments existed (`legacy`)
// is left out, so it stays that way until products are assigned to it.
export const recipientsPayload = (form) => {
  const additionalRecipients = (form.additionalRecipients || []).map(normaliseEmail)
  return {
    primaryRecipient: normaliseEmail(form.primaryRecipient),
    additionalRecipients,
    notifyNewLoanApplication: !!form.notifyNewLoanApplication,
    recipientProducts: additionalRecipients
      .map((email) => ({ email, a: assignmentOf(form, email) }))
      .filter(({ a }) => !a.legacy)
      .map(({ email, a }) => ({ email, allProducts: !!a.allProducts, productIds: [...a.productIds] }))
  }
}

// The test recipient is not a setting: it never stops a save, and is required
// only for Send Test Email.
export const testRecipientError = (value, { required = false } = {}) => {
  const email = String(value || '').trim()
  if (!email) return required ? 'Enter the address to send the test email to' : ''
  return isValidEmail(email) ? '' : 'Enter a valid email address'
}

// ── Provider (Email API card) ─────────────────────────────────────────────────

export const defaultProvider = () => ({
  tenantId: '',
  clientId: '',
  clientSecret: '',
  senderEmail: '',
  senderName: ''
})

// `secretStored` says whether the server already holds a readable client
// secret; only then may the secret field be left blank.
export const validateProvider = (form, { secretStored = false } = {}) => {
  const errors = {}
  const tenant = String(form.tenantId || '').trim()
  if (!tenant) errors.tenantId = 'Tenant ID is required'
  else if (SHARED_AUTHORITIES.includes(tenant.toLowerCase())) errors.tenantId = 'Enter your own directory (tenant) ID; shared sign-in names such as "common" cannot be used here'
  else if (!isTenantId(tenant)) errors.tenantId = 'Enter a directory (tenant) ID or a domain such as contoso.onmicrosoft.com'

  if (!String(form.clientId || '').trim()) errors.clientId = 'Application (client) ID is required'
  else if (!isGuid(form.clientId)) errors.clientId = 'Enter the application (client) ID in the form 00000000-0000-0000-0000-000000000000'

  const secret = String(form.clientSecret || '').trim()
  if (secret && !SECRET_PATTERN.test(secret)) errors.clientSecret = 'Client secret must be 8-512 characters, with no spaces or line breaks'
  else if (!secret && !secretStored) errors.clientSecret = 'Client secret is required'

  if (!String(form.senderEmail || '').trim()) errors.senderEmail = 'Sender mailbox is required'
  else if (!isValidEmail(form.senderEmail)) errors.senderEmail = 'Enter a valid email address'

  const name = String(form.senderName || '')
  if (name.trim().length > 100) errors.senderName = 'Sender name must not exceed 100 characters'
  else if (/[\r\n]/.test(name)) errors.senderName = 'Sender name must not contain line breaks'
  return errors
}

// The secret field always starts blank — the server never sends it back.
export const providerFromConfig = (config) => {
  const s = config?.settings
  if (!s) return defaultProvider()
  return {
    tenantId: s.tenantId || '',
    clientId: s.clientId || '',
    clientSecret: '',
    senderEmail: s.senderEmail || '',
    senderName: s.senderName || ''
  }
}

// A blank secret is left out, which the server reads as "keep the one stored".
export const providerPayload = (form) => {
  const payload = {
    provider: 'microsoft365',
    authMethod: 'graph',
    tenantId: String(form.tenantId || '').trim(),
    clientId: String(form.clientId || '').trim(),
    senderEmail: normaliseEmail(form.senderEmail),
    senderName: String(form.senderName || '').trim()
  }
  const secret = String(form.clientSecret || '').trim()
  if (secret) payload.clientSecret = secret
  return payload
}

export const secretStoredIn = (config) => !!(config?.clientSecret?.configured && config.clientSecret.readable)

// ── Shared ────────────────────────────────────────────────────────────────────

// Whether a form differs from what it started as — trimmed, with addresses and
// identifiers compared case-insensitively, so retyping a value identically is
// not a change. A typed secret is a change.
// Product assignments compare as sets, by recipient.
const comparableAssignments = (map) => Object.keys(map || {}).sort().map((email) => {
  const a = map[email]
  return [email, !!a.legacy, !!a.allProducts, [...(a.productIds || [])].sort()]
})

const comparable = (form) => Object.fromEntries(Object.entries(form).map(([k, v]) => [
  k,
  k === 'recipientProducts' ? comparableAssignments(v)
    : Array.isArray(v) ? v.map(normaliseEmail)
      : typeof v === 'string' ? (k === 'senderName' || k === 'clientSecret' ? v.trim() : v.trim().toLowerCase())
        : v
]))

export const isDirty = (form, baseline) => JSON.stringify(comparable(form)) !== JSON.stringify(comparable(baseline))

// The order fields appear on each form, so a failed save can move focus to the
// first problem a keyboard user would meet.
export const RECIPIENT_FIELD_ORDER = ['primaryRecipient', 'additionalRecipients']
export const PROVIDER_FIELD_ORDER = ['tenantId', 'clientId', 'clientSecret', 'senderEmail', 'senderName']

export const firstErrorField = (errors, order) => {
  const keys = Object.keys(errors || {})
  for (const field of order) {
    const match = keys.find((k) => k === field || k.startsWith(`${field}.`))
    if (match) return match
  }
  return keys[0] || null
}

// Field errors from a 400, keyed like the validate functions' errors.
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

// The provider's status chip, from what the server last reported — never from
// a form. Shown on the API card and on Email Settings.
export const providerStatus = (config) => {
  if (!config?.saved || !config.settings?.tenantId) return { label: 'Not set up', color: 'default' }
  if (config.clientSecret?.configured && !config.clientSecret.readable) return { label: 'Client secret unreadable — enter it again', color: 'error' }
  if (!config.provider?.configured) return { label: 'Incomplete', color: 'warning' }
  const t = config.lastTest
  if (!t) return { label: 'Saved — not tested', color: 'default' }
  if (!t.ok) return { label: t.kind === 'email' ? 'Test email failed' : 'Connection failed', color: 'error' }
  return { label: t.kind === 'email' ? 'Test email accepted' : 'Connected', color: 'success' }
}

// Whether new-loan-application emails will actually go out, and if not, why.
export const notificationReadiness = (config) => {
  if (!config?.provider?.configured) return { ready: false, reason: 'The email provider is not set up. Configure it in the API section first.' }
  if (!config.recipients?.configured) return { ready: false, reason: 'No primary recipient is saved yet.' }
  if (config.settings?.notifyNewLoanApplication === false) return { ready: false, reason: 'Loan application emails are turned off.' }
  return { ready: true, reason: '' }
}

// ── Recipient product assignments (Email Settings) ────────────────────────────
//
// Which loan products each additional recipient is emailed about. The primary
// recipient is emailed about every application and has no assignment. The
// server checks every id against the product catalogue and matches it with the
// product saved on each application; this only shapes the form.
//
// An assignment: { productIds, allProducts, legacy }. `legacy` marks a
// recipient saved before assignments existed — emailed about every
// application until products are assigned to it.

const LEGACY_ASSIGNMENT = { allProducts: true, legacy: true, productIds: [] }
const EMPTY_ASSIGNMENT = { allProducts: false, legacy: false, productIds: [] }

export const assignmentsFromConfig = (config) => {
  const map = {}
  for (const a of config?.settings?.recipientProducts || []) {
    map[normaliseEmail(a.email)] = { allProducts: !!a.allProducts, legacy: !!a.legacy, productIds: (a.productIds || []).map(String) }
  }
  return map
}

// A recipient the form knows nothing about is treated as the server treats it.
export const assignmentOf = (form, email) => form?.recipientProducts?.[normaliseEmail(email)] || LEGACY_ASSIGNMENT

// A recipient added on this page starts with no products.
export const withNewRecipientAssignment = (map, email) => ({ ...(map || {}), [normaliseEmail(email)]: { ...EMPTY_ASSIGNMENT } })

export const withoutRecipientAssignment = (map, email) => {
  const next = { ...(map || {}) }
  delete next[normaliseEmail(email)]
  return next
}

// Choosing products, or removing "every application", makes the assignment
// specific: from then on the recipient is emailed about these products only.
export const withRecipientProducts = (map, email, productIds) => ({
  ...(map || {}),
  [normaliseEmail(email)]: { allProducts: false, legacy: false, productIds: [...new Set(productIds)] }
})

export const assignmentSummary = (assignment) => {
  const a = assignment || LEGACY_ASSIGNMENT
  if (a.legacy) return 'Receives every loan application, as before product assignments. Assign products to limit it.'
  if (a.allProducts) return 'Receives every loan application.'
  const n = (a.productIds || []).length
  if (!n) return 'No products assigned: receives no loan application emails.'
  return `Receives applications for ${n === 1 ? '1 assigned product' : `${n} assigned products`} only.`
}

// One option per product: the catalogue as the products API returns it, plus
// any assigned product it does not include (deleted since, or a list that
// could not be loaded), described by what the settings say about it.
export const productOptions = (catalogue = [], config = null) => {
  const options = (catalogue || []).map((p) => ({
    _id: String(p._id),
    name: p.name || '',
    category: p.category?.name || '',
    isActive: p.isActive !== false,
    exists: true
  }))
  const known = new Set(options.map((o) => o._id))
  for (const a of config?.settings?.recipientProducts || []) {
    for (const p of a.products || []) {
      if (!known.has(String(p._id))) {
        known.add(String(p._id))
        options.push({ ...p, _id: String(p._id) })
      }
    }
  }
  return options
}

export const productName = (option) => option?.name || (option?.exists === false ? 'Deleted product' : 'Unknown product')
export const productOptionLabel = (option) => `${productName(option)} — ${option?._id || ''}`
// What the search box matches: name, category and id.
export const productSearchText = (option) => `${productName(option)} ${option?.category || ''} ${option?._id || ''}`

export const PRODUCTS_ACCESS_NEEDED = 'Assigning products needs view access to Products. Assigned products are still listed and can be removed.'

export const productCatalogueError = (err) => (err?.response?.status === 403
  ? PRODUCTS_ACCESS_NEEDED
  : requestErrorMessage(err, 'Could not load the product list.'))

// Where the Email API card lives on the API page.
export const EMAIL_API_PATH = '/integrations/api#email-provider'
