import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  recipientsFromConfig, recipientsPayload, isDirty, assignmentsFromConfig, assignmentOf, assignmentSummary,
  withNewRecipientAssignment, withoutRecipientAssignment, withRecipientProducts,
  productOptions, productName, productOptionLabel, productSearchText, productCatalogueError
} from './emailSettings.js'
import { OUTCOME_LABELS } from './emailNotifications.js'

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const C = 'cccccccccccccccccccccccc'

const config = () => ({
  settings: {
    primaryRecipient: 'ops@example.test',
    additionalRecipients: ['old@example.test', 'msme@example.test'],
    notifyNewLoanApplication: true,
    recipientProducts: [
      { email: 'old@example.test', allProducts: true, legacy: true, productIds: [], products: [] },
      { email: 'msme@example.test', allProducts: false, legacy: false, productIds: [A, C], products: [
        { _id: A, name: 'MSME Loan', isActive: true, category: 'Business Loan', exists: true },
        { _id: C, name: '', isActive: false, category: '', exists: false }
      ] }
    ]
  }
})

test('assignments load per recipient, and a recipient the settings do not mention is treated as before', () => {
  const form = recipientsFromConfig(config())
  assert.deepEqual(form.recipientProducts, {
    'old@example.test': { allProducts: true, legacy: true, productIds: [] },
    'msme@example.test': { allProducts: false, legacy: false, productIds: [A, C] }
  })
  assert.deepEqual(assignmentOf(form, 'MSME@Example.test').productIds, [A, C])
  assert.deepEqual(assignmentOf(form, 'unknown@example.test'), { allProducts: true, legacy: true, productIds: [] })
  assert.deepEqual(assignmentsFromConfig(null), {})
})

test('a recipient added on the page starts with no products; removing one drops its products', () => {
  const map = withNewRecipientAssignment({}, ' New@Example.test ')
  assert.deepEqual(map, { 'new@example.test': { allProducts: false, legacy: false, productIds: [] } })
  assert.deepEqual(withoutRecipientAssignment(map, 'NEW@example.test'), {})
})

test('choosing products, or removing "every application", limits a recipient to those products', () => {
  const form = recipientsFromConfig(config())
  const chosen = withRecipientProducts(form.recipientProducts, 'old@example.test', [B, B])
  assert.deepEqual(chosen['old@example.test'], { allProducts: false, legacy: false, productIds: [B] })
  const cleared = withRecipientProducts(form.recipientProducts, 'old@example.test', [])
  assert.deepEqual(cleared['old@example.test'], { allProducts: false, legacy: false, productIds: [] })
})

test('the save sends assignments for recipients set on the page, and leaves untouched older ones out', () => {
  const form = recipientsFromConfig(config())
  assert.deepEqual(recipientsPayload(form).recipientProducts, [
    { email: 'msme@example.test', allProducts: false, productIds: [A, C] }
  ])
  const edited = { ...form, recipientProducts: withRecipientProducts(form.recipientProducts, 'old@example.test', [B]) }
  assert.deepEqual(recipientsPayload(edited).recipientProducts, [
    { email: 'old@example.test', allProducts: false, productIds: [B] },
    { email: 'msme@example.test', allProducts: false, productIds: [A, C] }
  ])
  // An assignment left behind by a removed recipient is never sent.
  const removed = { ...form, additionalRecipients: ['old@example.test'] }
  assert.deepEqual(recipientsPayload(removed).recipientProducts, [])
})

test('changing products is an unsaved change; reordering them is not', () => {
  const form = recipientsFromConfig(config())
  const baseline = recipientsFromConfig(config())
  assert.equal(isDirty(form, baseline), false)
  assert.equal(isDirty({ ...form, recipientProducts: withRecipientProducts(form.recipientProducts, 'msme@example.test', [C, A]) }, baseline), false)
  assert.equal(isDirty({ ...form, recipientProducts: withRecipientProducts(form.recipientProducts, 'msme@example.test', [A]) }, baseline), true)
  assert.equal(isDirty({ ...form, recipientProducts: withRecipientProducts(form.recipientProducts, 'old@example.test', []) }, baseline), true)
})

test('each recipient\'s summary says plainly what it will receive', () => {
  assert.match(assignmentSummary({ allProducts: true, legacy: true, productIds: [] }), /every loan application, as before product assignments/)
  assert.equal(assignmentSummary({ allProducts: true, legacy: false, productIds: [] }), 'Receives every loan application.')
  assert.equal(assignmentSummary({ allProducts: false, legacy: false, productIds: [] }), 'No products assigned: receives no loan application emails.')
  assert.equal(assignmentSummary({ allProducts: false, legacy: false, productIds: [A] }), 'Receives applications for 1 assigned product only.')
  assert.equal(assignmentSummary({ allProducts: false, legacy: false, productIds: [A, B] }), 'Receives applications for 2 assigned products only.')
})

test('options come from the catalogue, plus assigned products it no longer has', () => {
  const catalogue = [
    { _id: A, name: 'MSME Loan', isActive: true, category: { name: 'Business Loan' } },
    { _id: B, name: 'Old Loan', isActive: false, category: null }
  ]
  assert.deepEqual(productOptions(catalogue, config()).map((o) => [o._id, o.name, o.category, o.isActive, o.exists]), [
    [A, 'MSME Loan', 'Business Loan', true, true],
    [B, 'Old Loan', '', false, true],
    [C, '', '', false, false]
  ])
  // A catalogue that could not be loaded still shows what is assigned.
  assert.deepEqual(productOptions([], config()).map((o) => o._id), [A, C])
})

test('each product is shown with its name and id, and found by name, category or id', () => {
  const p = { _id: A, name: 'MSME Loan', category: 'Business Loan' }
  assert.equal(productOptionLabel(p), `MSME Loan — ${A}`)
  assert.equal(productName({ _id: C, exists: false }), 'Deleted product')
  for (const part of ['MSME Loan', 'Business Loan', A]) assert.ok(productSearchText(p).includes(part))
})

test('a product list the user may not read is explained', () => {
  assert.match(productCatalogueError({ response: { status: 403 } }), /needs view access to Products/)
  assert.match(productCatalogueError({ response: { status: 500 } }), /./)
})

test('the app-wide product filter is gone from the delivery log labels', () => {
  assert.equal(OUTCOME_LABELS.PRODUCT_NOT_SELECTED, undefined)
})
