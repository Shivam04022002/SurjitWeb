import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileStatus, fileErrorMessage, opensInline } from './privateFiles.js'

test('only files that are in storage can be opened', () => {
  assert.equal(fileStatus('available').openable, true)
  assert.equal(fileStatus('recorded').openable, true)
  assert.equal(fileStatus('missing').openable, false)
  assert.equal(fileStatus('unrecognised').openable, false)
  assert.equal(fileStatus('not_provided').openable, false)
  assert.equal(fileStatus(undefined).openable, false)
})

test('each refusal reads as what it is', () => {
  assert.match(fileErrorMessage(401, 'CV'), /session has expired/)
  assert.equal(fileErrorMessage(403, 'CV'), 'You do not have access to this CV.')
  assert.equal(fileErrorMessage(404, 'CV'), 'That CV is no longer available in storage.')
  assert.match(fileErrorMessage(500, 'CV'), /could not be opened/)
  assert.match(fileErrorMessage(undefined), /document could not be opened/)
})

test('only safe types open in a tab', () => {
  assert.equal(opensInline('application/pdf'), true)
  assert.equal(opensInline('image/svg+xml'), false)
  assert.equal(opensInline('text/html'), false)
  assert.equal(opensInline('application/msword'), false)
})
