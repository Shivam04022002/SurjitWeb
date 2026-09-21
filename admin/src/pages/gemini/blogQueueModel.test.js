// Unit tests for the generation-list rules shared by Single Blog and Bulk
// Upload. Plain Node test runner, no browser:  npm test
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  newRow, fromValidated, planInputs, applyValidation, editPlan, counts, ids, dedupeSlugs, hasUnsaved, PLAN_STAGE
} from './blogQueueModel.js'

const CAT = { _id: 'c1', name: 'Business Loans' }
const ok = (over = {}) => ({ date: '2026-10-05', topic: 'Topic', category: null, generateImage: true, imageDefaulted: false, errors: [], warnings: [], ...over })
const generated = (row, over = {}) => ({
  ...row,
  status: 'generated',
  form: { title: 'T', slug: 'same-slug', summary: 's', content: '<p>c</p>', author: 'a', category: '', tags: '', seo: { metaTitle: '', metaDescription: '', metaKeywords: '' } },
  saveKey: 'save_x',
  ...over
})

describe('Add to list', () => {
  test('a new row is pending, requests an image by default and has a key-shaped id', () => {
    const r = newRow({ source: 'single', input: { date: '2026-10-05', topic: 'Kirana growth', category: '' } })
    assert.equal(r.status, 'pending')
    assert.equal(r.input.generateImage, true)
    assert.match(r.id, /^row_[A-Za-z0-9]{8,}$/)
    assert.equal(r.form, null)
    assert.ok(PLAN_STAGE.includes(r.status))
  })

  test('server validation marks rows pending or invalid', () => {
    const a = newRow({ input: { date: '2026-10-05', topic: 'One' } })
    const b = newRow({ input: { date: 'bad', topic: 'Two' } })
    const out = applyValidation([a, b], [a.id, b.id], [
      ok({ topic: 'One', category: CAT }),
      ok({ date: null, topic: 'Two', errors: [{ field: 'date', message: 'Date "bad" is not in DD/MM/YYYY format' }] })
    ])
    assert.equal(out[0].status, 'pending')
    assert.deepEqual(out[0].category, CAT)
    assert.equal(out[1].status, 'invalid')
    assert.match(out[1].errors[0].message, /DD\/MM\/YYYY/)
  })

  test('validation never touches a row that has already been generated', () => {
    const g = generated(newRow({ input: { topic: 'G' } }))
    const out = applyValidation([g], [g.id], [ok({ errors: [{ field: 'topic', message: 'dup' }] })])
    assert.equal(out[0].status, 'generated')
    assert.equal(out[0].errors.length, 0)
  })

  test('a reply for rows that have since been removed is ignored', () => {
    const a = newRow({ input: { topic: 'A' } })
    const out = applyValidation([a], ['row_gone'], [ok({ errors: [{ field: 'date', message: 'x' }] })])
    assert.equal(out[0].status, 'pending')
  })
})

describe('Edit and remove list items', () => {
  test('editing a row returns it to the plan stage and drops any generated content', () => {
    const g = generated(newRow({ input: { topic: 'Old' } }), { file: {}, status: 'gen_failed', error: 'boom' })
    const e = editPlan(g, { date: '2026-10-09', topic: 'New topic', category: 'c1', generateImage: false })
    assert.equal(e.id, g.id, 'same row')
    assert.equal(e.status, 'pending')
    assert.equal(e.error, '')
    assert.equal(e.form, null)
    assert.equal(e.file, null)
    assert.equal(e.saveKey, null)
    assert.deepEqual(e.input, { date: '2026-10-09', topic: 'New topic', category: 'c1', generateImage: false })
  })

  test('counts follow the list after a row is removed', () => {
    const a = { ...newRow({ input: { topic: 'A' } }), generateImage: true }
    const b = { ...newRow({ input: { topic: 'B' } }), status: 'invalid' }
    assert.deepEqual([counts([a, b]).valid, counts([a, b]).invalid], [1, 1])
    const left = [a, b].filter((r) => r.id !== b.id)
    assert.deepEqual([counts(left).valid, counts(left).invalid, counts(left).imagesRequested], [1, 0, 1])
  })
})

describe('Generate all and retry', () => {
  test('Generate All targets pending rows only; Retry Failed targets failed rows only', () => {
    const rows = [
      { ...newRow({ input: { topic: 'p' } }), status: 'pending' },
      { ...newRow({ input: { topic: 'i' } }), status: 'invalid' },
      { ...newRow({ input: { topic: 'f' } }), status: 'gen_failed' },
      generated(newRow({ input: { topic: 'g' } })),
      { ...generated(newRow({ input: { topic: 's' } })), status: 'saved' }
    ]
    assert.deepEqual(ids(rows, ['pending']), [rows[0].id])
    assert.deepEqual(ids(rows, ['gen_failed']), [rows[2].id])
    assert.deepEqual(ids(rows, ['generated', 'save_failed']), [rows[3].id])
  })

  test('summary: valid, invalid, images requested, ready to save, without image', () => {
    const rows = [
      { ...newRow({ input: {} }), generateImage: true },
      { ...newRow({ input: {} }), generateImage: false },
      { ...newRow({ input: {} }), status: 'invalid', generateImage: true },
      generated(newRow({ input: {} }), { file: null }),
      generated(newRow({ input: {} }), { file: {}, image: { status: 'ready' } })
    ]
    const c = counts(rows)
    assert.equal(c.total, 5)
    assert.equal(c.valid, 4)
    assert.equal(c.invalid, 1)
    assert.equal(c.imagesRequested, 3)
    assert.equal(c.withContent, 2)
    assert.equal(c.generated, 2, 'the status tally is separate')
    assert.equal(c.readyToSave, 2)
    assert.equal(c.withoutImage, 1)
  })

  test('plan inputs send what was entered for plan rows, and normalised values for generated rows', () => {
    const plan = { ...newRow({ sourceRow: 7, input: { date: '31/02/2026', topic: 'Raw', category: 'General', generateImage: 'maybe' } }) }
    const gen = generated({ ...newRow({ input: { date: 'x' } }), date: '2026-10-05', topic: 'Norm', category: CAT })
    assert.deepEqual(planInputs([plan, gen]), [
      { date: '31/02/2026', topic: 'Raw', category: 'General', generateImage: 'maybe', sourceRow: 7 },
      { date: '2026-10-05', topic: 'Norm', category: 'c1', generateImage: true }
    ])
  })

  test('an imported row keeps what the file said', () => {
    const r = fromValidated({
      sourceRow: 4, input: { date: '31/02/2026', topic: 'T', category: 'Business Loans', generateImage: '' },
      date: null, topic: 'T', category: CAT, generateImage: true, imageDefaulted: true,
      errors: [{ field: 'date', message: 'does not exist' }], warnings: []
    }, 'excel')
    assert.equal(r.status, 'invalid')
    assert.equal(r.sourceRow, 4)
    assert.equal(r.input.date, '31/02/2026')
    assert.equal(r.input.category, 'c1', 'a matched category is re-sent by id')
    assert.equal(r.imageDefaulted, true)
  })
})

describe('Save all as drafts', () => {
  test('duplicate slugs in a batch get a suffix; saved drafts keep theirs', () => {
    const saved = { ...generated(newRow({ input: {} })), status: 'saved', savedBlog: { slug: 'same-slug' } }
    const a = generated(newRow({ input: {} }))
    const b = generated(newRow({ input: {} }))
    const out = dedupeSlugs([saved, a, b], [a.id, b.id])
    assert.deepEqual(out.map((r) => r.form.slug), ['same-slug', 'same-slug-2', 'same-slug-3'])
  })

  test('unsaved generated blogs are detected before a destructive action', () => {
    const plan = newRow({ input: {} })
    assert.equal(hasUnsaved([plan]), false)
    assert.equal(hasUnsaved([plan, generated(newRow({ input: {} }))]), true)
    assert.equal(hasUnsaved([{ ...generated(newRow({ input: {} })), status: 'saved' }]), false)
  })
})
