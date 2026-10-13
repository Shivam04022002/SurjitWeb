import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVIDERS, AUTH_METHODS, ENCRYPTION, MAX_ADDITIONAL_RECIPIENTS, SUPPORTED,
  defaultEmailSettings, applyProvider, isValidEmail, isTenantId, isGuid, isHost, isPort,
  recipientError, addRecipient, removeRecipient, validateEmailSettings, firstErrorField, isDirty,
  oauthPermissionHint, isSupported, isProviderAvailable, testRecipientError,
  formFromConfig, payloadFromForm, secretStoredIn, serverFieldErrors, requestErrorMessage, connectionStatus
} from './emailSettings.js'

const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47'
const CLIENT = '11111111-2222-3333-4444-555555555555'
const SECRET = 'Qx8~Abc.def_GhiJkl-MnoPqrStuVwxYz0123456789'

const validForm = (overrides = {}) => ({
  ...defaultEmailSettings(),
  senderEmail: 'loans@surjitfinance.com',
  tenantId: TENANT,
  clientId: CLIENT,
  clientSecret: SECRET,
  primaryRecipient: 'ops@surjitfinance.com',
  ...overrides
})

// What GET /v1/email-settings returns once something is saved.
const savedConfig = (overrides = {}) => ({
  saved: true,
  configured: true,
  missing: [],
  supported: SUPPORTED,
  settings: {
    provider: 'microsoft365',
    authMethod: 'graph',
    senderName: 'Surjit Finance',
    senderEmail: 'loans@surjitfinance.com',
    tenantId: TENANT,
    clientId: CLIENT,
    primaryRecipient: 'ops@surjitfinance.com',
    additionalRecipients: ['credit@surjitfinance.com'],
    notifyNewLoanApplication: false
  },
  clientSecret: { configured: true, readable: true, hint: '6789' },
  lastTest: null,
  updatedAt: '2026-10-13T06:00:00.000Z',
  ...overrides
})

const axiosError = (status, data = {}) => ({ response: { status, data } })

// ── Providers and defaults ────────────────────────────────────────────────────

test('starts on Microsoft 365 with Microsoft Graph, the supported method', () => {
  const form = defaultEmailSettings()
  assert.equal(form.provider, 'microsoft365')
  assert.equal(form.authMethod, AUTH_METHODS.GRAPH)
  assert.equal(form.smtpHost, 'smtp.office365.com')
  assert.equal(form.encryption, ENCRYPTION.STARTTLS)
  assert.equal(form.notifyNewLoanApplication, true)
  assert.equal(form.clientSecret, '')
  assert.deepEqual(form.additionalRecipients, [])
})

test('only Microsoft 365 with Graph is supported; the rest are marked unavailable', () => {
  assert.deepEqual(SUPPORTED, [{ provider: 'microsoft365', authMethod: 'graph' }])
  assert.ok(isSupported('microsoft365', AUTH_METHODS.GRAPH))
  assert.ok(!isSupported('microsoft365', AUTH_METHODS.SMTP_OAUTH))
  assert.ok(!isSupported('outlook', AUTH_METHODS.GRAPH))
  assert.ok(isProviderAvailable('microsoft365'))
  assert.ok(!isProviderAvailable('outlook') && !isProviderAvailable('exchange'))
})

test('every provider offers only auth methods it lists, with a supported default', () => {
  for (const p of Object.values(PROVIDERS)) assert.ok(p.authMethods.includes(p.defaultAuthMethod), p.key)
  assert.ok(!PROVIDERS.microsoft365.authMethods.includes(AUTH_METHODS.SMTP_BASIC))
  assert.ok(!PROVIDERS.outlook.authMethods.includes(AUTH_METHODS.SMTP_BASIC))
})

test('switching provider resets the endpoint and keeps sender and recipients', () => {
  const form = validForm({ additionalRecipients: ['a@x.com'] })
  const outlook = applyProvider(form, 'outlook')
  assert.equal(outlook.smtpHost, 'smtp-mail.outlook.com')
  assert.equal(outlook.tenantId, 'consumers')
  assert.equal(outlook.senderEmail, form.senderEmail)
  assert.deepEqual(outlook.additionalRecipients, ['a@x.com'])

  const exchange = applyProvider(outlook, 'exchange')
  assert.equal(exchange.smtpHost, '')
  assert.equal(exchange.authMethod, AUTH_METHODS.SMTP_BASIC, 'Graph is not an Exchange method, so its default applies')
  assert.equal(exchange.tenantId, '', 'the fixed consumers tenant is not carried over')

  const back = applyProvider(exchange, 'microsoft365')
  assert.equal(back.authMethod, AUTH_METHODS.GRAPH)
  assert.equal(back.smtpHost, 'smtp.office365.com')
})

test('an unknown provider leaves the form alone', () => {
  const form = validForm()
  assert.equal(applyProvider(form, 'gmail'), form)
})

// ── Field rules ───────────────────────────────────────────────────────────────

test('field format checks', () => {
  assert.ok(isValidEmail(' Loans@SurjitFinance.com '))
  for (const bad of ['', 'loans', 'loans@', '@x.com', 'a b@x.com', 'a@x', `${'a'.repeat(250)}@x.com`]) {
    assert.ok(!isValidEmail(bad), bad)
  }
  assert.ok(isGuid(CLIENT) && !isGuid('1111-2222'))
  assert.ok(isTenantId(TENANT) && isTenantId('contoso.onmicrosoft.com') && !isTenantId('not a tenant'))
  assert.ok(isHost('mail.example.com') && isHost('10.0.0.5') && !isHost('mail example.com') && !isHost('-bad.com'))
  assert.ok(isPort('587') && isPort(465) && isPort('65535'))
  for (const bad of ['0', '65536', '58a', '', '-1', '5870000']) assert.ok(!isPort(bad), bad)
})

test('recipients are validated and duplicates refused case-insensitively', () => {
  const form = { primaryRecipient: 'Ops@Surjit.com', additionalRecipients: ['a@surjit.com'] }
  assert.equal(recipientError('', form), 'Enter an email address')
  assert.equal(recipientError('nope', form), 'Enter a valid email address')
  assert.equal(recipientError(' ops@surjit.COM ', form), 'This address is already the primary recipient')
  assert.equal(recipientError('A@SURJIT.com', form), 'This address is already in the list')
  assert.equal(recipientError('a@surjit.com', form, 0), '', 'an entry is not a duplicate of itself')
  assert.equal(recipientError('b@surjit.com', form), '')
})

test('adding a recipient normalises it; a refused one leaves the list unchanged', () => {
  const form = { primaryRecipient: 'ops@surjit.com', additionalRecipients: ['a@surjit.com'] }
  assert.deepEqual(addRecipient(form, '  B@Surjit.com '), { additionalRecipients: ['a@surjit.com', 'b@surjit.com'], error: '' })
  const refused = addRecipient(form, 'A@surjit.com')
  assert.equal(refused.additionalRecipients, form.additionalRecipients)
  assert.ok(refused.error)
  const full = { primaryRecipient: '', additionalRecipients: Array.from({ length: MAX_ADDITIONAL_RECIPIENTS }, (_, i) => `r${i}@x.com`) }
  assert.match(addRecipient(full, 'new@x.com').error, /up to 10/)
})

test('removing a recipient drops only that entry', () => {
  assert.deepEqual(removeRecipient(['a@x.com', 'b@x.com', 'c@x.com'], 1), ['a@x.com', 'c@x.com'])
  assert.deepEqual(removeRecipient(undefined, 0), [])
})

test('a complete Microsoft 365 / Graph form validates cleanly', () => {
  assert.deepEqual(validateEmailSettings(validForm()), {})
  // SMTP fields are not used by Graph.
  assert.deepEqual(validateEmailSettings(validForm({ smtpHost: '', smtpPort: '', smtpUsername: '' })), {})
})

test('unsupported providers and methods are reported, not silently accepted', () => {
  assert.match(validateEmailSettings(applyProvider(validForm(), 'outlook')).authMethod, /Outlook Personal is not available yet/)
  assert.match(validateEmailSettings(applyProvider(validForm(), 'exchange')).authMethod, /Organization-managed Exchange is not available yet/)
  assert.match(validateEmailSettings(validForm({ authMethod: AUTH_METHODS.SMTP_OAUTH })).authMethod, /SMTP with Microsoft OAuth 2.0 is not available yet/)
  assert.match(validateEmailSettings(validForm({ authMethod: AUTH_METHODS.SMTP_BASIC })).authMethod, /supports/)
})

test('required fields are reported on an empty form', () => {
  const errors = validateEmailSettings(defaultEmailSettings())
  for (const field of ['senderEmail', 'tenantId', 'clientId', 'clientSecret', 'primaryRecipient']) assert.ok(errors[field], field)
})

test('the client secret may be blank only when the server already holds one', () => {
  assert.equal(validateEmailSettings(validForm({ clientSecret: '' })).clientSecret, 'Client secret is required')
  assert.equal(validateEmailSettings(validForm({ clientSecret: '' }), { secretStored: true }).clientSecret, undefined)
  assert.match(validateEmailSettings(validForm({ clientSecret: 'has spaces in it' }), { secretStored: true }).clientSecret, /no spaces/)
  assert.match(validateEmailSettings(validForm({ clientSecret: 'short' })).clientSecret, /8-512/)
})

test('Graph needs a specific tenant, not a shared sign-in authority', () => {
  for (const t of ['common', 'Organizations', 'consumers']) {
    assert.match(validateEmailSettings(validForm({ tenantId: t })).tenantId, /shared sign-in/, t)
  }
})

test('a sender name with a line break is refused', () => {
  assert.match(validateEmailSettings(validForm({ senderName: 'Surjit\r\nBcc: x@y.com' })).senderName, /line breaks/)
})

test('bad additional recipients are reported per entry', () => {
  const errors = validateEmailSettings(validForm({ additionalRecipients: ['good@x.com', 'bad', 'GOOD@x.com', 'ops@surjitfinance.com'] }))
  assert.equal(errors['additionalRecipients.0'], undefined)
  assert.equal(errors['additionalRecipients.1'], 'Enter a valid email address')
  assert.equal(errors['additionalRecipients.2'], 'This address is already in the list')
  assert.equal(errors['additionalRecipients.3'], 'This address is already the primary recipient')
})

test('the test recipient never blocks a save, and is required only to send', () => {
  assert.deepEqual(validateEmailSettings(validForm({ testRecipient: 'not-an-email' })), {})
  assert.equal(testRecipientError(''), '')
  assert.equal(testRecipientError('', { required: true }), 'Enter the address to send the test email to')
  assert.equal(testRecipientError('nope', { required: true }), 'Enter a valid email address')
  assert.equal(testRecipientError(' Tester@Example.com ', { required: true }), '')
})

test('the first error follows the order fields appear on the page', () => {
  assert.equal(firstErrorField({ primaryRecipient: 'x', senderEmail: 'y' }), 'senderEmail')
  assert.equal(firstErrorField({ primaryRecipient: 'x', clientSecret: 'y' }), 'clientSecret')
  assert.equal(firstErrorField({ 'additionalRecipients.2': 'y' }), 'additionalRecipients.2')
  assert.equal(firstErrorField({}), null)
})

test('dirty tracking: whitespace, case and the test recipient are not changes; a typed secret is', () => {
  const base = validForm({ clientSecret: '' })
  assert.equal(isDirty(base, base), false)
  assert.equal(isDirty({ ...base, senderEmail: ' LOANS@surjitfinance.com ' }, base), false)
  assert.equal(isDirty({ ...base, testRecipient: 'someone@x.com' }, base), false, 'typing a test address does not disable Send')
  assert.equal(isDirty({ ...base, clientSecret: SECRET }, base), true)
  assert.equal(isDirty({ ...base, notifyNewLoanApplication: false }, base), true)
  assert.equal(isDirty({ ...base, additionalRecipients: ['a@x.com'] }, base), true)
})

test('the permission hint names what each provider and method needs', () => {
  assert.match(oauthPermissionHint('microsoft365', AUTH_METHODS.GRAPH), /Mail\.Send/)
  assert.match(oauthPermissionHint('microsoft365', AUTH_METHODS.SMTP_OAUTH), /SMTP\.SendAsApp/)
  assert.match(oauthPermissionHint('outlook', AUTH_METHODS.SMTP_OAUTH), /SMTP\.Send and offline_access/)
  assert.equal(oauthPermissionHint('exchange', AUTH_METHODS.SMTP_BASIC), '')
})

// ── Loading and saving ────────────────────────────────────────────────────────

test('nothing saved: the form starts from the defaults', () => {
  assert.deepEqual(formFromConfig({ saved: false, settings: null }), defaultEmailSettings())
  assert.deepEqual(formFromConfig(null), defaultEmailSettings())
})

test('a saved configuration loads into the form, with the secret field blank', () => {
  const form = formFromConfig(savedConfig())
  assert.equal(form.senderEmail, 'loans@surjitfinance.com')
  assert.equal(form.tenantId, TENANT)
  assert.deepEqual(form.additionalRecipients, ['credit@surjitfinance.com'])
  assert.equal(form.notifyNewLoanApplication, false)
  assert.equal(form.clientSecret, '', 'the server never sends the secret')
  assert.equal(form.smtpHost, 'smtp.office365.com')
  assert.deepEqual(validateEmailSettings(form, { secretStored: true }), {}, 'a loaded form saves as-is')
  assert.equal(isDirty(form, formFromConfig(savedConfig())), false)
})

test('the loaded list is a copy, so editing the form cannot alter the loaded config', () => {
  const config = savedConfig()
  formFromConfig(config).additionalRecipients.push('x@y.com')
  assert.deepEqual(config.settings.additionalRecipients, ['credit@surjitfinance.com'])
})

test('the save payload omits a blank secret and carries a typed one', () => {
  const blank = payloadFromForm(validForm({ clientSecret: '  ', senderEmail: ' Loans@SurjitFinance.com ', smtpHost: 'x' }))
  assert.equal('clientSecret' in blank, false, 'blank means keep the stored secret')
  assert.equal(blank.senderEmail, 'loans@surjitfinance.com')
  assert.equal('smtpHost' in blank, false)
  assert.equal('testRecipient' in blank, false)
  assert.deepEqual(Object.keys(blank).sort(), ['additionalRecipients', 'authMethod', 'clientId', 'notifyNewLoanApplication', 'primaryRecipient', 'provider', 'senderEmail', 'senderName', 'tenantId'])
  assert.equal(payloadFromForm(validForm({ clientSecret: ` ${SECRET} ` })).clientSecret, SECRET)
})

test('a stored secret counts only while the server can read it', () => {
  assert.equal(secretStoredIn(savedConfig()), true)
  assert.equal(secretStoredIn(savedConfig({ clientSecret: { configured: true, readable: false, hint: '6789' } })), false)
  assert.equal(secretStoredIn({ saved: false }), false)
})

test('server field errors map onto the form', () => {
  const err = axiosError(400, { message: 'Validation failed', errors: [{ field: 'authMethod', message: 'Outlook Personal is not available yet.' }, { field: 'clientSecret', message: 'Enter the client secret' }] })
  assert.deepEqual(serverFieldErrors(err), { authMethod: 'Outlook Personal is not available yet.', clientSecret: 'Enter the client secret' })
  assert.deepEqual(serverFieldErrors(new Error('network')), {})
})

test('request failures are explained, permission errors included', () => {
  assert.match(requestErrorMessage(axiosError(403), 'x'), /edit access to API Settings/)
  assert.match(requestErrorMessage(axiosError(401), 'x'), /session has expired/)
  assert.equal(requestErrorMessage(axiosError(429, { message: 'Email test limit reached for this hour.' }), 'x'), 'Email test limit reached for this hour.')
  assert.equal(requestErrorMessage(axiosError(400, { errors: [{ field: 'recipient', message: 'Enter a valid email address' }] }), 'x'), 'Enter a valid email address')
  assert.match(requestErrorMessage(axiosError(500), 'x'), /could not complete/)
  assert.match(requestErrorMessage(new Error('Network Error'), 'x'), /No response/)
})

// ── Connection status ─────────────────────────────────────────────────────────

test('status comes from what the server reported', () => {
  assert.equal(connectionStatus(null).label, 'Not configured')
  assert.equal(connectionStatus({ saved: false }).label, 'Not configured')
  assert.equal(connectionStatus(savedConfig()).label, 'Saved — not tested')
  assert.equal(connectionStatus(savedConfig({ configured: false, missing: ['Client secret'] })).label, 'Incomplete')
  assert.match(connectionStatus(savedConfig({ configured: false, clientSecret: { configured: true, readable: false, hint: '1' } })).label, /unreadable/)

  const at = '2026-10-13T06:00:00.000Z'
  assert.deepEqual(connectionStatus(savedConfig({ lastTest: { at, kind: 'connection', ok: true, code: 'CONNECTED', message: '' } })), { label: 'Connected', color: 'success' })
  assert.deepEqual(connectionStatus(savedConfig({ lastTest: { at, kind: 'connection', ok: false, code: 'INVALID_CLIENT_SECRET', message: '' } })), { label: 'Connection failed', color: 'error' })
  assert.deepEqual(connectionStatus(savedConfig({ lastTest: { at, kind: 'email', ok: true, code: 'SENT', message: '' } })), { label: 'Test email accepted', color: 'success' })
  assert.deepEqual(connectionStatus(savedConfig({ lastTest: { at, kind: 'email', ok: false, code: 'ACCESS_DENIED', message: '' } })), { label: 'Test email failed', color: 'error' })
})
