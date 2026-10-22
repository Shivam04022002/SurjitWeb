import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_CAPTION, dialogPhase, canPublish, captionProblem, publishEnabled,
  shouldPoll, errorCode, isPostUrn, callbackMessage
} from './linkedinShare.js'

const preview = (overrides = {}) => ({
  connection: { state: 'connected' },
  blockers: [],
  publication: null,
  ...overrides
})

test('the phase follows the connection, blockers and publication record', () => {
  assert.equal(dialogPhase(null), 'loading')
  assert.equal(dialogPhase(preview()), 'ready')
  assert.equal(dialogPhase(preview({ connection: { state: 'not_connected' } })), 'not_connected')
  assert.equal(dialogPhase(preview({ connection: { state: 'reconnect_required' } })), 'reconnect_required')
  assert.equal(dialogPhase(preview({ connection: { state: 'not_configured' } })), 'not_configured')
  assert.equal(dialogPhase(preview({ blockers: [{ code: 'IMAGE_MISSING' }] })), 'blocked')
  assert.equal(dialogPhase(preview({ publication: { status: 'failed' } })), 'failed')
})

test('a publication in progress, done or uncertain overrides everything else', () => {
  const p = preview({ connection: { state: 'reconnect_required' } })
  assert.equal(dialogPhase(p, { status: 'published' }), 'published')
  assert.equal(dialogPhase(p, { status: 'publishing' }), 'publishing')
  assert.equal(dialogPhase(p, { status: 'unknown' }), 'unknown')
  // A freshly fetched record takes precedence over the preview's copy.
  assert.equal(dialogPhase(preview({ publication: { status: 'publishing' } }), { status: 'published' }), 'published')
})

test('only ready and failed may publish; an uncertain outcome may not be retried from here', () => {
  for (const phase of ['ready', 'failed']) assert.equal(canPublish(phase), true, phase)
  for (const phase of ['loading', 'not_connected', 'reconnect_required', 'blocked', 'publishing', 'published', 'unknown']) {
    assert.equal(canPublish(phase), false, phase)
  }
})

test('captions: required, not blank, within the limit', () => {
  assert.match(captionProblem(''), /Write a caption/)
  assert.match(captionProblem('  \r\n '), /Write a caption/)
  assert.equal(captionProblem('Hello'), '')
  assert.equal(captionProblem('x'.repeat(MAX_CAPTION)), '')
  assert.match(captionProblem('x'.repeat(MAX_CAPTION + 1)), /at most 2800/)
  assert.match(captionProblem('abcd', 3), /at most 3/)
})

test('publishing needs the explicit confirmation tick, a valid caption and no request running', () => {
  const ok = { phase: 'ready', caption: 'Hello', confirmed: true, busy: false }
  assert.equal(publishEnabled(ok), true)
  assert.equal(publishEnabled({ ...ok, confirmed: false }), false, 'editing the caption alone never publishes')
  assert.equal(publishEnabled({ ...ok, confirmed: 'true' }), false)
  assert.equal(publishEnabled({ ...ok, caption: ' ' }), false)
  assert.equal(publishEnabled({ ...ok, busy: true }), false)
  assert.equal(publishEnabled({ ...ok, phase: 'published' }), false)
  assert.equal(publishEnabled({ ...ok, phase: 'failed' }), true)
})

test('polling continues only while publishing', () => {
  assert.equal(shouldPoll({ status: 'publishing' }), true)
  for (const status of ['published', 'failed', 'unknown']) assert.equal(shouldPoll({ status }), false)
  assert.equal(shouldPoll(null), false)
})

test('server error codes and post URNs', () => {
  assert.equal(errorCode({ response: { data: { errors: [{ code: 'ALREADY_PUBLISHED' }] } } }), 'ALREADY_PUBLISHED')
  assert.equal(errorCode(new Error('x')), '')
  assert.equal(isPostUrn('urn:li:share:123'), true)
  assert.equal(isPostUrn(' urn:li:ugcPost:456 '), true)
  for (const bad of ['', 'urn:li:share:', 'https://linkedin.com/x', 'urn:li:image:1']) assert.equal(isPostUrn(bad), false, bad)
})

test('callback results map to messages; anything else is ignored', () => {
  assert.equal(callbackMessage('connected')[0], 'success')
  assert.equal(callbackMessage('cancelled')[0], 'warning')
  assert.equal(callbackMessage('<script>'), null)
})
