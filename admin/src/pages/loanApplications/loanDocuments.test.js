import { test } from 'node:test'
import assert from 'node:assert/strict'
import { documentStatus, attachedDocuments, documentSummary, applicationIdFromSearch, opensInline } from './loanDocuments.js'

const docs = [
  { type: 'aadhaar', status: 'available' },
  { type: 'pan', status: 'missing' },
  { type: 'bank-statement', status: 'not_provided' },
  { type: 'business-proof', status: 'unrecognised' }
]

test('each document status reads clearly, and only real files are openable', () => {
  assert.equal(documentStatus('available').label, 'Received')
  assert.equal(documentStatus('available').openable, true)
  assert.equal(documentStatus('missing').openable, false)
  assert.equal(documentStatus('unrecognised').openable, false)
  assert.equal(documentStatus('not_provided').label, 'Not attached')
  assert.equal(documentStatus('weird').openable, false)
})

test('the summary counts attached documents and unavailable ones', () => {
  assert.equal(attachedDocuments(docs).length, 3)
  assert.equal(documentSummary(docs), '3 documents attached, 2 unavailable')
  assert.equal(documentSummary([{ status: 'not_provided' }]), 'No documents were attached to this application.')
  assert.equal(documentSummary([{ status: 'available' }]), '1 document attached')
})

test('the deep link accepts only a database id', () => {
  assert.equal(applicationIdFromSearch('?application=6a48a190095ac1ab65d2c9b8'), '6a48a190095ac1ab65d2c9b8')
  for (const bad of ['', '?application=', '?application=../../x', '?application=6a48a190095ac1ab65d2c9b8&x', '?application=javascript:alert(1)', '?other=6a48a190095ac1ab65d2c9b8']) {
    const got = applicationIdFromSearch(bad)
    assert.ok(got === null || got === '6a48a190095ac1ab65d2c9b8', bad)
  }
  assert.equal(applicationIdFromSearch('?application=javascript:alert(1)'), null)
})

test('only browser-safe types open in a tab', () => {
  assert.equal(opensInline('application/pdf'), true)
  assert.equal(opensInline('image/png'), true)
  assert.equal(opensInline('image/svg+xml'), false)
  assert.equal(opensInline('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), false)
})
