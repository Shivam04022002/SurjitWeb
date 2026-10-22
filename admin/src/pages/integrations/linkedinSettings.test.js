import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEnvManaged, normalizeOrganizationId, versionError, formFromConfig, validateForm,
  buildPayload, isDirty, reconnectReasons, outcomeSeverity, modeLabel, serverFieldErrors
} from './linkedinSettings.js'

// What GET /v1/linkedin/config returns once saved from the CMS.
const saved = (overrides = {}) => ({
  clientId: { value: '86abc123def456', source: 'database' },
  clientSecret: { configured: true, source: 'database', readable: true },
  organizationId: { value: '1234567', source: 'database' },
  apiVersion: { value: '202610', source: 'database', warning: '' },
  scopes: { value: ['w_organization_social', 'r_organization_admin'], source: 'database', roleCheck: true },
  redirectUri: { value: 'https://cms-api.surjitfinance.com/api/v1/linkedin/oauth/callback', source: 'environment' },
  ...overrides
})
const empty = () => ({
  clientId: { value: '', source: 'none' },
  clientSecret: { configured: false, source: 'none', readable: true },
  organizationId: { value: '', source: 'none' },
  apiVersion: { value: '202610', source: 'default' },
  scopes: { value: ['w_organization_social', 'r_organization_admin'], source: 'default', roleCheck: true }
})

test('the form starts from the saved values, with the secret field always empty', () => {
  const form = formFromConfig(saved())
  assert.deepEqual(form, { clientId: '86abc123def456', clientSecret: '', organizationId: '1234567', apiVersion: '202610', verifyRole: true })
})

test('page IDs and versions are normalised and checked like the server does', () => {
  assert.equal(normalizeOrganizationId('urn:li:organization:001234'), '1234')
  assert.equal(normalizeOrganizationId('abc'), null)
  assert.equal(versionError('202610', new Date('2026-10-22')), '')
  assert.match(versionError('2026-10'), /YYYYMM/)
  assert.match(versionError('202612', new Date('2026-10-22')), /future/)
})

test('a new setup needs every field, including the secret', () => {
  const errors = validateForm(formFromConfig(empty()), empty())
  assert.deepEqual(Object.keys(errors).sort(), ['clientId', 'clientSecret', 'organizationId'])
})

test('with a stored secret the secret field may stay empty; a typed one must look valid', () => {
  const form = formFromConfig(saved())
  assert.deepEqual(validateForm(form, saved()), {})
  assert.ok(validateForm({ ...form, clientSecret: 'has space' }, saved()).clientSecret)
})

test('the payload omits an empty secret (keeping the stored one) and normalises the page ID', () => {
  const form = { ...formFromConfig(saved()), organizationId: 'urn:li:organization:999' }
  const payload = buildPayload(form, saved())
  assert.equal('clientSecret' in payload, false)
  assert.equal(payload.organizationId, '999')
  assert.equal(buildPayload({ ...form, clientSecret: ' newSecret123 ' }, saved()).clientSecret, 'newSecret123')
})

test('fields managed by the server environment are never sent or validated', () => {
  const config = saved({ clientId: { value: 'envclient', source: 'environment' }, clientSecret: { configured: true, source: 'environment' }, scopes: { value: ['w_organization_social'], source: 'environment', roleCheck: false } })
  assert.equal(isEnvManaged(config, 'clientId'), true)
  assert.equal(isEnvManaged(config, 'verifyRole'), true)
  const payload = buildPayload({ ...formFromConfig(config), clientSecret: 'typedAnyway1' }, config)
  assert.deepEqual(Object.keys(payload).sort(), ['apiVersion', 'organizationId'])
  assert.deepEqual(validateForm({ ...formFromConfig(config), clientId: '!' }, config), {})
})

test('dirty tracking notices a typed secret and real changes only', () => {
  const config = saved()
  const form = formFromConfig(config)
  assert.equal(isDirty(form, config), false)
  assert.equal(isDirty({ ...form, organizationId: 'urn:li:organization:1234567' }, config), false)
  assert.equal(isDirty({ ...form, clientSecret: 'x' }, config), true)
  assert.equal(isDirty({ ...form, verifyRole: false }, config), true)
})

test('only a different app, page or permission set warns about reconnecting', () => {
  const config = saved()
  const form = formFromConfig(config)
  const connected = { state: 'connected' }
  assert.deepEqual(reconnectReasons({ ...form, clientSecret: 'newSecret1' }, config, connected), [])
  assert.deepEqual(reconnectReasons({ ...form, apiVersion: '202609' }, config, connected), [])
  assert.deepEqual(reconnectReasons({ ...form, clientId: 'other12345' }, config, connected), ['the Client ID'])
  assert.deepEqual(reconnectReasons({ ...form, organizationId: '7' }, config, connected), ['the company page ID'])
  assert.deepEqual(reconnectReasons({ ...form, clientId: 'other12345' }, config, { state: 'not_connected' }), [])
})

test('test outcomes map to severities, and the mode line never confuses readiness with live', () => {
  assert.equal(outcomeSeverity('CONNECTED_AUTHORIZED'), 'success')
  assert.equal(outcomeSeverity('AUTHORIZATION_REQUIRED'), 'info')
  assert.equal(outcomeSeverity('API_REQUEST_FAILED'), 'error')
  assert.match(modeLabel('readiness'), /not contacted/)
  assert.match(modeLabel('live'), /Nothing was posted/)
})

test('server field errors are mapped to the form', () => {
  const err = { response: { data: { errors: [{ field: 'clientId', code: 'MANAGED_BY_ENVIRONMENT', message: 'x' }, { field: 'apiVersion', code: 'INVALID', message: 'bad' }, { field: 'linkedin', code: 'X' }] } } }
  assert.deepEqual(serverFieldErrors(err), { clientId: 'Managed by the server environment', apiVersion: 'bad' })
})
