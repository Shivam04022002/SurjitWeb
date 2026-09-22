// Unit tests for the draft form the CMS sends when saving a generated blog.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildDraftFormData, imageSourceOf } from './geminiBlogUtils.js'
import { newRow, editPlan } from './blogQueueModel.js'

const form = {
  title: 'T', slug: 't', summary: 'S', content: '<p>c</p>', author: 'A', category: '', tags: 'a',
  seo: { metaTitle: 'M', metaDescription: 'D', metaKeywords: 'k' }
}
const credit = {
  source: 'pexels', photoId: '102', photoUrl: 'https://www.pexels.com/photo/x-102/',
  photographer: 'Asha Rao', photographerUrl: 'https://www.pexels.com/@asha-rao'
}
const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

describe('Pexels credit in the draft form', () => {
  test('the credit travels with the Pexels photo', () => {
    const fd = buildDraftFormData(form, '2026-10-20', file, { idempotencyKey: 'save_abc12345', imageCredit: credit })
    assert.equal(fd.get('imageCredit.source'), 'pexels')
    assert.equal(fd.get('imageCredit.photographer'), 'Asha Rao')
    assert.equal(fd.get('imageCredit.photoUrl'), credit.photoUrl)
    assert.equal(fd.get('imageCredit.photographerUrl'), credit.photographerUrl)
    assert.ok(fd.get('featuredImage'))
    assert.equal(fd.get('idempotencyKey'), 'save_abc12345')
    assert.equal(fd.has('status'), false, 'never sends a status')
  })

  test('no photo, no credit', () => {
    const fd = buildDraftFormData(form, '2026-10-20', null, { imageCredit: credit })
    assert.equal(fd.has('imageCredit.source'), false)
    assert.equal(fd.has('featuredImage'), false)
  })

  test('a row starts without a credit, and editing it drops any credit', () => {
    const r = newRow({ input: { topic: 'x' } })
    assert.equal(r.imageCredit, null)
    assert.deepEqual(r.offeredPhotoIds, [])
    const edited = editPlan({ ...r, imageCredit: credit, file }, { date: '2026-10-20', topic: 'y', category: '', generateImage: true })
    assert.equal(edited.imageCredit, null)
    assert.equal(edited.file, null)
  })
})

describe('AI featured image metadata in the draft form', () => {
  test('an AI image sends its provider, model and branding', () => {
    const fd = buildDraftFormData(form, '2026-10-20', file, {
      imageMeta: { provider: 'gemini', model: 'gemini-3.1-flash-image', modelName: 'Nano Banana 2', branded: true }
    })
    assert.equal(fd.get('imageMeta.provider'), 'gemini')
    assert.equal(fd.get('imageMeta.model'), 'gemini-3.1-flash-image')
    assert.equal(fd.get('imageMeta.branded'), 'true')
    assert.equal(fd.has('imageMeta.modelName'), false, 'display names are not stored')
  })

  test('an AI image never carries a stale Pexels credit', () => {
    const fd = buildDraftFormData(form, '2026-10-20', file, {
      imageMeta: { provider: 'gemini', model: 'gemini-3.1-flash-image', branded: true }, imageCredit: credit
    })
    assert.equal(fd.has('imageCredit.source'), false)
  })

  test('a Pexels fallback image sends its provider and credit, but no model', () => {
    const fd = buildDraftFormData(form, '2026-10-20', file, { imageMeta: { provider: 'pexels', branded: true }, imageCredit: credit })
    assert.equal(fd.get('imageMeta.provider'), 'pexels')
    assert.equal(fd.has('imageMeta.model'), false)
    assert.equal(fd.get('imageCredit.photographer'), 'Asha Rao')
  })

  test('a manual upload, or no image at all, sends no metadata', () => {
    assert.equal(buildDraftFormData(form, '2026-10-20', file, {}).has('imageMeta.provider'), false)
    const none = buildDraftFormData(form, '2026-10-20', null, { imageMeta: { provider: 'gemini', model: 'gemini-3.1-flash-image' } })
    assert.equal(none.has('imageMeta.provider'), false)
    assert.equal(none.has('featuredImage'), false)
  })
})

describe('Featured image source label in Review', () => {
  test('AI, Pexels and manual upload are told apart', () => {
    assert.deepEqual(imageSourceOf({ hasFile: true, imageMeta: { provider: 'gemini', model: 'gemini-3.1-flash-image', modelName: 'Nano Banana 2' } }),
      { kind: 'gemini', label: 'AI Generated', detail: 'Nano Banana 2' })
    assert.equal(imageSourceOf({ hasFile: true, imageMeta: { provider: 'pexels' } }).label, 'Featured image from Pexels')
    assert.equal(imageSourceOf({ hasFile: true, imageMeta: null }).label, 'Manual upload')
    assert.equal(imageSourceOf({ hasFile: false, imageMeta: { provider: 'gemini' } }), null)
  })

  test('new rows and edited plans start with no image source and no attempts', () => {
    const row = newRow({ input: { topic: 'x' } })
    assert.equal(row.imageMeta, null)
    assert.equal(row.imageAttempts, 0)
    const edited = editPlan({ ...row, imageMeta: { provider: 'gemini' }, imageAttempts: 3, imageNotice: 'n' }, { date: '', topic: 'y', category: '', generateImage: true })
    assert.deepEqual([edited.imageMeta, edited.imageAttempts, edited.imageNotice], [null, 0, ''])
  })
})
