// The LinkedIn settings form's rules, kept apart from the component so they
// can be tested without a browser. The server validates everything again;
// these only give the admin immediate feedback and build what is sent.

export const FIELD_ORDER = ['clientId', 'clientSecret', 'organizationId', 'apiVersion']

// Which server variable takes precedence over each field.
export const ENV_VARIABLES = {
  clientId: 'LINKEDIN_CLIENT_ID',
  clientSecret: 'LINKEDIN_CLIENT_SECRET',
  organizationId: 'LINKEDIN_ORGANIZATION_ID',
  apiVersion: 'LINKEDIN_API_VERSION',
  verifyRole: 'LINKEDIN_SCOPES'
}

export const isEnvManaged = (config, field) => {
  const key = field === 'verifyRole' ? 'scopes' : field
  return config?.[key]?.source === 'environment'
}

// "1234567" or "urn:li:organization:1234567" → "1234567"; anything else null.
export const normalizeOrganizationId = (value) => {
  const m = /^(?:urn:li:organization:)?([0-9]{1,20})$/.exec(String(value ?? '').trim())
  return m ? m[1].replace(/^0+(?=\d)/, '') : null
}

export const versionError = (value, now = new Date()) => {
  const m = /^(20[0-9]{2})(0[1-9]|1[0-2])$/.exec(String(value ?? '').trim())
  if (!m) return 'Use YYYYMM, e.g. 202610'
  if (Number(m[1]) * 12 + Number(m[2]) > now.getFullYear() * 12 + now.getMonth() + 1) return 'That version is in the future'
  return ''
}

// The form's starting values from GET /config. The secret field always starts
// empty: the stored secret is never sent to the browser.
export const formFromConfig = (config) => ({
  clientId: config?.clientId?.value || '',
  clientSecret: '',
  organizationId: config?.organizationId?.value || '',
  apiVersion: config?.apiVersion?.value || '',
  verifyRole: config ? config.scopes?.roleCheck !== false : true
})

// Per-field messages for the editable fields.
export const validateForm = (form, config) => {
  const errors = {}
  if (!isEnvManaged(config, 'clientId') && !/^[A-Za-z0-9]{6,64}$/.test(form.clientId.trim())) {
    errors.clientId = 'Enter the Client ID from the LinkedIn app\'s Auth tab'
  }
  if (!isEnvManaged(config, 'clientSecret')) {
    const secret = form.clientSecret.trim()
    if (!secret && !config?.clientSecret?.configured) errors.clientSecret = 'Enter the Primary Client Secret'
    else if (secret && !/^[\x21-\x7E]{8,256}$/.test(secret)) errors.clientSecret = 'That does not look like a LinkedIn client secret'
  }
  if (!isEnvManaged(config, 'organizationId') && !normalizeOrganizationId(form.organizationId)) {
    errors.organizationId = 'Enter the numeric company page ID'
  }
  if (!isEnvManaged(config, 'apiVersion')) {
    const e = versionError(form.apiVersion)
    if (e) errors.apiVersion = e
  }
  return errors
}

// What PUT /config receives: only editable fields, the page ID normalised,
// and the secret only when a new one was typed (empty keeps the stored one).
export const buildPayload = (form, config) => {
  const payload = {}
  if (!isEnvManaged(config, 'clientId')) payload.clientId = form.clientId.trim()
  if (!isEnvManaged(config, 'clientSecret') && form.clientSecret.trim()) payload.clientSecret = form.clientSecret.trim()
  if (!isEnvManaged(config, 'organizationId')) payload.organizationId = normalizeOrganizationId(form.organizationId) || form.organizationId.trim()
  if (!isEnvManaged(config, 'apiVersion')) payload.apiVersion = form.apiVersion.trim()
  if (!isEnvManaged(config, 'verifyRole')) payload.verifyRole = form.verifyRole
  return payload
}

export const isDirty = (form, config) => {
  const start = formFromConfig(config)
  return form.clientSecret.trim() !== '' ||
    ['clientId', 'apiVersion', 'verifyRole'].some((k) => form[k] !== start[k]) ||
    (normalizeOrganizationId(form.organizationId) || form.organizationId) !== start.organizationId
}

// Whether saving this form would end a working connection, so the CMS can
// ask first. A new secret alone does not; a different app or page does.
export const reconnectReasons = (form, config, connection) => {
  if (connection?.state !== 'connected') return []
  const reasons = []
  if (!isEnvManaged(config, 'clientId') && form.clientId.trim() !== (config?.clientId?.value || '')) reasons.push('the Client ID')
  if (!isEnvManaged(config, 'organizationId') && (normalizeOrganizationId(form.organizationId) || '') !== (config?.organizationId?.value || '')) reasons.push('the company page ID')
  if (!isEnvManaged(config, 'verifyRole') && form.verifyRole !== (config?.scopes?.roleCheck !== false)) reasons.push('the requested permissions')
  return reasons
}

// How each Test Configuration outcome is shown.
export const OUTCOME_SEVERITY = {
  CONFIG_INCOMPLETE: 'error',
  AUTHORIZATION_REQUIRED: 'info',
  RECONNECT_REQUIRED: 'warning',
  CONNECTED_AUTHORIZED: 'success',
  ORGANIZATION_NOT_VERIFIED: 'warning',
  NO_ORGANIZATION_ROLE: 'error',
  PUBLISHING_PERMISSION_MISSING: 'error',
  API_REQUEST_FAILED: 'error'
}

export const outcomeSeverity = (outcome) => OUTCOME_SEVERITY[outcome] || 'info'

// The line that keeps a readiness check from being mistaken for a live one.
export const modeLabel = (mode) => (mode === 'live'
  ? 'Live check: an authorized, read-only request was made to LinkedIn. Nothing was posted.'
  : 'Readiness check only: LinkedIn was not contacted.')

export const serverFieldErrors = (err) => Object.fromEntries(
  (err?.response?.data?.errors || []).filter((e) => FIELD_ORDER.includes(e.field) || e.field === 'verifyRole')
    .map((e) => [e.field, e.code === 'MANAGED_BY_ENVIRONMENT' ? 'Managed by the server environment' : e.message])
)
