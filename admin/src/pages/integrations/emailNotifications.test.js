import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STATUS_META, STATUS_ORDER, OUTCOME_LABELS, statusMeta, outcomeLabel, filtersToParams, attemptsLabel, canRetry,
  applicantLine, documentCountOf, recipientsLabel, previewNotice, eventLabel
} from './emailNotifications.js'

test('every status the server reports has a label, colour and explanation', () => {
  for (const s of ['pending', 'sending', 'retrying', 'sent', 'skipped', 'failed', 'unconfirmed']) {
    assert.ok(STATUS_META[s].label && STATUS_META[s].color && STATUS_META[s].description, s)
  }
  assert.deepEqual([...STATUS_ORDER].sort(), Object.keys(STATUS_META).sort())
})

test('a sent email reads as accepted by Microsoft, never as delivered', () => {
  assert.equal(STATUS_META.sent.label, 'Accepted by Microsoft')
  assert.ok(!/deliver(ed)?\b/i.test(STATUS_META.sent.label))
  assert.match(STATUS_META.sent.description, /not proof/)
})

test('an unconfirmed send is explained as uncertain and never resent', () => {
  assert.equal(STATUS_META.unconfirmed.label, 'Delivery uncertain')
  assert.match(STATUS_META.unconfirmed.description, /may or may not/)
  assert.match(STATUS_META.unconfirmed.description, /never resent automatically/)
  assert.notEqual(STATUS_META.unconfirmed.label, STATUS_META.failed.label)
})

test('unknown statuses and codes are shown as they are', () => {
  assert.deepEqual(statusMeta('archived'), { label: 'archived', color: 'default', description: '' })
  assert.equal(outcomeLabel('SOMETHING_NEW'), 'SOMETHING_NEW')
  assert.equal(outcomeLabel(''), '')
  assert.equal(outcomeLabel('SEND_UNCONFIRMED'), OUTCOME_LABELS.SEND_UNCONFIRMED)
})

test('outcome labels are fixed text, not Microsoft messages', () => {
  for (const label of Object.values(OUTCOME_LABELS)) assert.ok(!/AADSTS|https?:\/\//.test(label), label)
})

test('filters become a query; pages are 1-based and capped at 100', () => {
  assert.deepEqual(filtersToParams({}), { params: { page: 1, limit: 20 } })
  assert.deepEqual(filtersToParams({ status: 'unconfirmed', from: '2026-10-01', to: '2026-10-13', page: 2, pageSize: 50 }),
    { params: { page: 3, limit: 50, status: 'unconfirmed', from: '2026-10-01', to: '2026-10-13' } })
  assert.equal(filtersToParams({ pageSize: 500 }).params.limit, 100)
})

test('bad filters are caught before asking the server', () => {
  assert.ok(filtersToParams({ status: 'delivered' }).error)
  assert.ok(filtersToParams({ from: '13/10/2026' }).error)
  assert.ok(filtersToParams({ to: '2026-10' }).error)
  assert.match(filtersToParams({ from: '2026-10-13', to: '2026-10-01' }).error, /before/)
  assert.equal(filtersToParams({ from: '2026-10-01', to: '2026-10-01' }).error, undefined)
})

test('attempts read as a count of the limit', () => {
  assert.equal(attemptsLabel({ attempts: 2, maxAttempts: 3 }), '2 of 3')
})

test('Retry now needs both the server\'s say-so and edit access', () => {
  assert.equal(canRetry({ retryable: true }, { canEdit: true }), true)
  assert.equal(canRetry({ retryable: true }, { canEdit: false }), false)
  assert.equal(canRetry({ retryable: false, status: 'unconfirmed' }, { canEdit: true }), false)
  assert.equal(canRetry(null, { canEdit: true }), false)
})

test('applicant line: name and product, hidden, or missing', () => {
  assert.deepEqual(applicantLine({ applicant: { name: 'Asha', product: 'E-Rickshaw Loan' } }), { name: 'Asha', product: 'E-Rickshaw Loan' })
  assert.equal(applicantLine({ applicantHidden: true }).name, 'Applicant hidden')
  assert.equal(applicantLine({ applicationMissing: true }).name, 'Application no longer exists')
})

test('document count and recipients columns', () => {
  assert.equal(documentCountOf({ applicant: { documentCount: 2 } }), 2)
  assert.equal(documentCountOf({ applicantHidden: true, documentCount: 3 }), 3)
  assert.equal(documentCountOf({ applicantHidden: true, documentCount: null }), null)
  assert.equal(recipientsLabel({ status: 'sent', recipientSummary: 'ops@x.com +1', recipientCount: 2 }), 'ops@x.com +1')
  assert.equal(recipientsLabel({ status: 'sent', recipientSummary: '', recipientCount: 2 }), '2')
  assert.equal(recipientsLabel({ status: 'failed', recipientSummary: 'ops@x.com' }), '—')
})

test('the preview is always labelled as rebuilt, and warns when it may differ from what was sent', () => {
  assert.equal(previewNotice(null), null)
  const same = previewNotice({ templateVersion: 'loan-application/v2', sentTemplateVersion: 'loan-application/v2', applicationChangedSinceSent: false })
  assert.equal(same.severity, 'info')
  assert.match(same.notes[0], /not a stored copy/)
  const old = previewNotice({ templateVersion: 'loan-application/v2', sentTemplateVersion: null, applicationChangedSinceSent: false })
  assert.equal(old.severity, 'warning')
  assert.match(old.notes[1], /earlier, shorter layout/)
  const changed = previewNotice({ templateVersion: 'v2', sentTemplateVersion: 'v2', applicationChangedSinceSent: true })
  assert.match(changed.notes[1], /changed since/)
})

test('history events read as attempts', () => {
  assert.equal(eventLabel({ attempt: 1, status: 'retrying', code: 'MICROSOFT_UNAVAILABLE' }), 'Attempt 1: Retry scheduled — Microsoft was temporarily unavailable')
  assert.equal(eventLabel({ attempt: 2, status: 'sent', code: 'SENT' }), 'Attempt 2: Accepted by Microsoft')
  assert.equal(eventLabel({ attempt: null, status: 'unconfirmed', code: 'SEND_UNCONFIRMED' }), 'Delivery uncertain — The send did not complete — delivery is uncertain')
})
