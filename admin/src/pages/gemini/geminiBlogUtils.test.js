// Unit tests for the draft form the CMS sends when saving a generated blog.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildDraftFormData } from './geminiBlogUtils.js'
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
