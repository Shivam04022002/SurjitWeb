import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  productIdsFromConfig, productRulesDirty, productOptions, productName, productOptionLabel,
  productSearchText, productRulesSummary, productCatalogueError
} from './emailSettings.js'
import { OUTCOME_LABELS } from './emailNotifications.js'

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const C = 'cccccccccccccccccccccccc'

test('an empty selection is described as no filter, never as "send nothing"', () => {
  assert.match(productRulesSummary([]), /every new loan application sends the email \(no product filter\)/)
  assert.match(productRulesSummary(undefined), /no product filter/)
  assert.match(productRulesSummary([A]), /^Only applications for the selected product send the email/)
  assert.match(productRulesSummary([A, B]), /the 2 selected products/)
  assert.match(productRulesSummary([A]), /submitted without a product, do not/)
})

test('the saved selection is read from the settings, and edits are compared as a set', () => {
  assert.deepEqual(productIdsFromConfig(null), [])
  assert.deepEqual(productIdsFromConfig({ productRules: { productIds: [A, B] } }), [A, B])
  assert.equal(productRulesDirty([B, A], [A, B]), false)
  assert.equal(productRulesDirty([A], [A, B]), true)
  assert.equal(productRulesDirty([], []), false)
  assert.equal(productRulesDirty([C], [A]), true)
})

test('options come from the catalogue, plus selected products it no longer has', () => {
  const catalogue = [
    { _id: A, name: 'MSME Loan', isActive: true, category: { name: 'Business Loan' } },
    { _id: B, name: 'Old Loan', isActive: false, category: null }
  ]
  const config = { productRules: { productIds: [A, C], products: [
    { _id: A, name: 'MSME Loan', isActive: true, category: 'Business Loan', exists: true },
    { _id: C, name: '', isActive: false, category: '', exists: false }
  ] } }
  const options = productOptions(catalogue, config)
  assert.deepEqual(options.map((o) => [o._id, o.name, o.category, o.isActive, o.exists]), [
    [A, 'MSME Loan', 'Business Loan', true, true],
    [B, 'Old Loan', '', false, true],
    [C, '', '', false, false]
  ])
  // A catalogue that could not be loaded still shows what is selected.
  assert.deepEqual(productOptions([], config).map((o) => o._id), [A, C])
})

test('each product is shown with its name and id, and found by either', () => {
  const p = { _id: A, name: 'MSME Loan', category: 'Business Loan' }
  assert.equal(productOptionLabel(p), `MSME Loan — ${A}`)
  assert.equal(productName({ _id: C, exists: false }), 'Deleted product')
  assert.match(productSearchText(p), /MSME Loan/)
  assert.match(productSearchText(p), /Business Loan/)
  assert.match(productSearchText(p), new RegExp(A))
})

test('a product list the user may not read is explained, not shown as a failure to save', () => {
  assert.match(productCatalogueError({ response: { status: 403 } }), /needs view access to Products/)
  assert.match(productCatalogueError({ response: { status: 500 } }), /./)
})

test('the delivery log explains a product-filtered skip', () => {
  assert.match(OUTCOME_LABELS.PRODUCT_NOT_SELECTED, /Product Notification Rules/)
})
