import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ADDITIONAL_RECIPIENTS, isValidEmail, isGuid, isTenantId,
  recipientError, addRecipient, removeRecipient, defaultRecipients, validateRecipients,
  recipientsFromConfig, recipientsPayload, testRecipientError,
  defaultProvider, validateProvider, providerFromConfig, providerPayload, secretStoredIn,
  isDirty, firstErrorField, RECIPIENT_FIELD_ORDER, PROVIDER_FIELD_ORDER,
  serverFieldErrors, requestErrorMessage, providerStatus, notificationReadiness, EMAIL_API_PATH
} from './emailSettings.js'

const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47'
const CLIENT = '11111111-2222-3333-4444-555555555555'
const SECRET = 'Qx8~Abc.def_GhiJkl-MnoPqrStuVwxYz0123456789'

// What GET /v1/email-settings returns once both halves are saved.
const savedConfig = (overrides = {}) => ({
  saved: true,
  configured: true,
  missing: [],
  provider: { configured: true, missing: [] },
  recipients: { configured: true, missing: [] },
  settings: {
    provider: 'microsoft365',
    authMethod: 'graph',
    senderName: 'Surjit Finance',
    senderEmail: 'sender@example.test',
    tenantId: TENANT,
    clientId: CLIENT,
    primaryRecipient: 'primary@example.test',
    additionalRecipients: ['second@example.test'],
    notifyNewLoanApplication: false
  },
  clientSecret: { configured: true, readable: true, hint: '6789' },
  lastTest: null,
  updatedAt: '2026-10-13T06:00:00.000Z',
  ...overrides
})

const axiosError = (status, data = {}) => ({ response: { status, data } })
const validProvider = (overrides = {}) => ({ tenantId: TENANT, clientId: CLIENT, clientSecret: SECRET, senderEmail: 'sender@example.test', senderName: 'Surjit Finance', ...overrides })

// ── Field rules ───────────────────────────────────────────────────────────────

test('format checks', () => {
  assert.ok(isValidEmail(' Sender@Example.test '))
  for (const bad of ['', 'x', 'x@', '@x.test', 'a b@x.test', 'a@x', `${'a'.repeat(250)}@x.test`]) assert.ok(!isValidEmail(bad), bad)
  assert.ok(isGuid(CLIENT) && !isGuid('1111-2222'))
  assert.ok(isTenantId(TENANT) && isTenantId('contoso.onmicrosoft.com'))
  for (const bad of ['not a tenant', 'common', 'Organizations', 'consumers']) assert.ok(!isTenantId(bad), bad)
})

// ── Recipients ────────────────────────────────────────────────────────────────

test('recipients are validated and duplicates refused case-insensitively', () => {
  const form = { primaryRecipient: 'Ops@Surjit.test', additionalRecipients: ['a@surjit.test'] }
  assert.equal(recipientError('', form), 'Enter an email address')
  assert.equal(recipientError('nope', form), 'Enter a valid email address')
  assert.equal(recipientError(' ops@surjit.TEST ', form), 'This address is already the primary recipient')
  assert.equal(recipientError('A@SURJIT.test', form), 'This address is already in the list')
  assert.equal(recipientError('a@surjit.test', form, 0), '')
})

test('adding and removing recipients', () => {
  const form = { primaryRecipient: 'ops@surjit.test', additionalRecipients: ['a@surjit.test'] }
  assert.deepEqual(addRecipient(form, ' B@Surjit.test '), { additionalRecipients: ['a@surjit.test', 'b@surjit.test'], error: '' })
  assert.equal(addRecipient(form, 'A@surjit.test').additionalRecipients, form.additionalRecipients)
  const full = { additionalRecipients: Array.from({ length: MAX_ADDITIONAL_RECIPIENTS }, (_, i) => `r${i}@x.test`) }
  assert.match(addRecipient(full, 'new@x.test').error, /up to 10/)
  assert.deepEqual(removeRecipient(['a@x.test', 'b@x.test'], 0), ['b@x.test'])
})

test('the recipients form validates on its own — no credentials involved', () => {
  assert.deepEqual(validateRecipients({ primaryRecipient: 'ops@x.test', additionalRecipients: [] }), {})
  assert.equal(validateRecipients(defaultRecipients()).primaryRecipient, 'Primary recipient is required')
  const errors = validateRecipients({ primaryRecipient: 'ops@x.test', additionalRecipients: ['good@x.test', 'bad', 'GOOD@x.test', 'OPS@x.test'] })
  assert.equal(errors['additionalRecipients.0'], undefined)
  assert.equal(errors['additionalRecipients.1'], 'Enter a valid email address')
  assert.equal(errors['additionalRecipients.2'], 'This address is already in the list')
  assert.equal(errors['additionalRecipients.3'], 'This address is already the primary recipient')
})

test('saved recipients load, and save back without credential fields', () => {
  const form = recipientsFromConfig(savedConfig())
  assert.deepEqual(form, { primaryRecipient: 'primary@example.test', additionalRecipients: ['second@example.test'], notifyNewLoanApplication: false })
  const payload = recipientsPayload({ ...form, primaryRecipient: ' Primary@Example.test ' })
  assert.deepEqual(Object.keys(payload).sort(), ['additionalRecipients', 'notifyNewLoanApplication', 'primaryRecipient'])
  assert.equal(payload.primaryRecipient, 'primary@example.test')
  assert.deepEqual(recipientsFromConfig({ saved: false, settings: null }), defaultRecipients())
  // A copy, so editing the form cannot alter the loaded config.
  form.additionalRecipients.push('x@y.test')
  assert.deepEqual(savedConfig().settings.additionalRecipients, ['second@example.test'])
})

test('a provider-only document loads with an empty recipient form', () => {
  const config = savedConfig({ settings: { ...savedConfig().settings, primaryRecipient: '', additionalRecipients: [], notifyNewLoanApplication: true } })
  assert.deepEqual(recipientsFromConfig(config), defaultRecipients())
})

test('the test recipient is checked only for sending', () => {
  assert.equal(testRecipientError(''), '')
  assert.equal(testRecipientError('', { required: true }), 'Enter the address to send the test email to')
  assert.equal(testRecipientError('nope', { required: true }), 'Enter a valid email address')
  assert.equal(testRecipientError(' Tester@Example.test ', { required: true }), '')
})

// ── Provider ──────────────────────────────────────────────────────────────────

test('a complete provider form validates; every field is checked', () => {
  assert.deepEqual(validateProvider(validProvider()), {})
  const empty = validateProvider(defaultProvider())
  for (const f of ['tenantId', 'clientId', 'clientSecret', 'senderEmail']) assert.ok(empty[f], f)
  assert.equal(empty.senderName, undefined, 'the display name is optional')
  assert.match(validateProvider(validProvider({ tenantId: 'common' })).tenantId, /shared sign-in/)
  assert.match(validateProvider(validProvider({ clientId: '123' })).clientId, /00000000/)
  assert.match(validateProvider(validProvider({ senderName: 'A\r\nBcc: x@y.test' })).senderName, /line breaks/)
})

test('the secret may be blank only when the server holds a readable one', () => {
  assert.equal(validateProvider(validProvider({ clientSecret: '' })).clientSecret, 'Client secret is required')
  assert.equal(validateProvider(validProvider({ clientSecret: '' }), { secretStored: true }).clientSecret, undefined)
  assert.match(validateProvider(validProvider({ clientSecret: 'has spaces in it' }), { secretStored: true }).clientSecret, /no spaces/)
  assert.equal(secretStoredIn(savedConfig()), true)
  assert.equal(secretStoredIn(savedConfig({ clientSecret: { configured: true, readable: false, hint: '1' } })), false)
  assert.equal(secretStoredIn({ saved: false }), false)
})

test('saved credentials load with the secret field blank', () => {
  const form = providerFromConfig(savedConfig())
  assert.deepEqual(form, { tenantId: TENANT, clientId: CLIENT, clientSecret: '', senderEmail: 'sender@example.test', senderName: 'Surjit Finance' })
  assert.deepEqual(validateProvider(form, { secretStored: true }), {}, 'a loaded form saves as-is')
  assert.deepEqual(providerFromConfig(null), defaultProvider())
})

test('the provider payload omits a blank secret and never carries recipients', () => {
  const blank = providerPayload(validProvider({ clientSecret: '  ', senderEmail: ' Sender@Example.test ' }))
  assert.equal('clientSecret' in blank, false, 'blank keeps the stored secret')
  assert.equal(blank.senderEmail, 'sender@example.test')
  assert.deepEqual(Object.keys(blank).sort(), ['authMethod', 'clientId', 'provider', 'senderEmail', 'senderName', 'tenantId'])
  assert.deepEqual([blank.provider, blank.authMethod], ['microsoft365', 'graph'])
  assert.equal(providerPayload(validProvider({ clientSecret: ` ${SECRET} ` })).clientSecret, SECRET)
})

// ── Shared ────────────────────────────────────────────────────────────────────

test('dirty tracking ignores whitespace and case; a typed secret is a change', () => {
  const base = providerFromConfig(savedConfig())
  assert.equal(isDirty(base, base), false)
  assert.equal(isDirty({ ...base, senderEmail: ' SENDER@example.test ' }, base), false)
  assert.equal(isDirty({ ...base, clientSecret: SECRET }, base), true)
  const r = recipientsFromConfig(savedConfig())
  assert.equal(isDirty({ ...r, notifyNewLoanApplication: true }, r), true)
  assert.equal(isDirty({ ...r, additionalRecipients: ['SECOND@example.test'] }, r), false)
  assert.equal(isDirty({ ...r, additionalRecipients: [] }, r), true)
})

test('the first error follows each form\'s field order', () => {
  assert.equal(firstErrorField({ senderEmail: 'x', clientId: 'y' }, PROVIDER_FIELD_ORDER), 'clientId')
  assert.equal(firstErrorField({ 'additionalRecipients.2': 'x', primaryRecipient: 'y' }, RECIPIENT_FIELD_ORDER), 'primaryRecipient')
  assert.equal(firstErrorField({}, RECIPIENT_FIELD_ORDER), null)
})

test('server errors map onto fields and messages', () => {
  assert.deepEqual(serverFieldErrors(axiosError(400, { errors: [{ field: 'clientSecret', message: 'Enter the client secret' }] })), { clientSecret: 'Enter the client secret' })
  assert.deepEqual(serverFieldErrors(new Error('x')), {})
  assert.match(requestErrorMessage(axiosError(403), 'x'), /edit access to API Settings/)
  assert.match(requestErrorMessage(axiosError(401), 'x'), /session has expired/)
  assert.equal(requestErrorMessage(axiosError(429, { message: 'Email test limit reached for this hour.' }), 'x'), 'Email test limit reached for this hour.')
  assert.match(requestErrorMessage(new Error('Network Error'), 'x'), /No response/)
})

test('provider status comes from the shared configuration', () => {
  assert.equal(providerStatus(null).label, 'Not set up')
  assert.equal(providerStatus({ saved: true, settings: { ...savedConfig().settings, tenantId: '' }, provider: { configured: false } }).label, 'Not set up', 'a recipients-only document has no provider yet')
  assert.equal(providerStatus(savedConfig()).label, 'Saved — not tested')
  assert.equal(providerStatus(savedConfig({ provider: { configured: false, missing: ['Sender mailbox'] } })).label, 'Incomplete')
  assert.match(providerStatus(savedConfig({ clientSecret: { configured: true, readable: false, hint: '1' }, provider: { configured: false } })).label, /unreadable/)
  const at = '2026-10-13T06:00:00.000Z'
  assert.deepEqual(providerStatus(savedConfig({ lastTest: { at, kind: 'connection', ok: true } })), { label: 'Connected', color: 'success' })
  assert.deepEqual(providerStatus(savedConfig({ lastTest: { at, kind: 'connection', ok: false } })), { label: 'Connection failed', color: 'error' })
  assert.deepEqual(providerStatus(savedConfig({ lastTest: { at, kind: 'email', ok: true } })), { label: 'Test email accepted', color: 'success' })
})

test('loan emails are ready only with a provider, a recipient and notifications on', () => {
  assert.match(notificationReadiness(null).reason, /API section/)
  assert.match(notificationReadiness(savedConfig({ provider: { configured: false } })).reason, /API section/)
  assert.match(notificationReadiness(savedConfig({ recipients: { configured: false } })).reason, /primary recipient/)
  assert.match(notificationReadiness(savedConfig()).reason, /turned off/)
  const on = savedConfig({ settings: { ...savedConfig().settings, notifyNewLoanApplication: true } })
  assert.deepEqual(notificationReadiness(on), { ready: true, reason: '' })
})

test('Email Settings links to the Email API card on the API page', () => {
  assert.equal(EMAIL_API_PATH, '/integrations/api#email-provider')
})
