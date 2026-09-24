// Unit tests for what the Advertisement form refuses before it sends, and for
// what it puts on the wire when it does.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSafeApplyUrl, imageFileError, validateAdvertisement, buildAdvertisementPayload,
  advertisementError, formatBytes, MAX_IMAGE_BYTES
} from './advertisementUtils.js'

const png = (size = 1024) => {
  const file = new Blob([new Uint8Array(1)], { type: 'image/png' })
  // Blob size is fixed by its content, so the tests carry the size separately
  // where a large file is what is being checked.
  return Object.defineProperty(file, 'size', { value: size })
}

const valid = { name: 'Diwali offer', applyUrl: '/loan-application', applyButtonText: 'Apply Now', imageFile: null }

describe('apply URL', () => {
  test('accepts a page on this site and a full http(s) address', () => {
    assert.equal(isSafeApplyUrl('/loan-application'), true)
    assert.equal(isSafeApplyUrl('https://surjitfinance.com/apply'), true)
    assert.equal(isSafeApplyUrl('http://surjitfinance.com/apply'), true)
    assert.equal(isSafeApplyUrl('  /apply  '), true)
  })

  test('refuses anything that is not a page or an http(s) address', () => {
    assert.equal(isSafeApplyUrl('javascript:alert(1)'), false)
    assert.equal(isSafeApplyUrl('data:text/html,<script>'), false)
    assert.equal(isSafeApplyUrl('mailto:someone@example.com'), false)
    assert.equal(isSafeApplyUrl('//evil.example.com'), false)
    assert.equal(isSafeApplyUrl('not a url'), false)
    assert.equal(isSafeApplyUrl(''), false)
    assert.equal(isSafeApplyUrl(undefined), false)
  })
})

describe('image', () => {
  test('accepts the formats the API accepts', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']) {
      assert.equal(imageFileError(new Blob([], { type })), '', type)
    }
  })

  test('refuses another format', () => {
    assert.match(imageFileError(new Blob([], { type: 'application/pdf' })), /PNG, JPG/)
    assert.match(imageFileError(new Blob([], { type: 'image/gif' })), /PNG, JPG/)
  })

  test('refuses a file over the 5 MB the API allows', () => {
    assert.match(imageFileError(png(MAX_IMAGE_BYTES + 1)), /5 MB/)
    assert.equal(imageFileError(png(MAX_IMAGE_BYTES)), '')
  })

  test('no file is not an error — editing keeps the existing artwork', () => {
    assert.equal(imageFileError(null), '')
  })
})

describe('form validation', () => {
  test('a filled form passes', () => {
    assert.deepEqual(validateAdvertisement(valid), {})
  })

  test('name is required and capped', () => {
    assert.equal(validateAdvertisement({ ...valid, name: '   ' }).name, 'Name is required')
    assert.match(validateAdvertisement({ ...valid, name: 'x'.repeat(151) }).name, /150/)
    assert.equal(validateAdvertisement({ ...valid, name: 'x'.repeat(150) }).name, undefined)
  })

  test('an unusable apply URL is reported on its own field', () => {
    assert.ok(validateAdvertisement({ ...valid, applyUrl: 'javascript:alert(1)' }).applyUrl)
    assert.ok(validateAdvertisement({ ...valid, applyUrl: '' }).applyUrl)
  })

  test('button text is capped at 40', () => {
    assert.match(validateAdvertisement({ ...valid, applyButtonText: 'a'.repeat(41) }).applyButtonText, /40/)
    assert.equal(validateAdvertisement({ ...valid, applyButtonText: 'a'.repeat(40) }).applyButtonText, undefined)
  })

  test('publishing needs artwork, from the form or from the record', () => {
    assert.ok(validateAdvertisement(valid, { requireImage: true }).imageFile)
    assert.equal(validateAdvertisement(valid, { requireImage: true, hasExistingImage: true }).imageFile, undefined)
    assert.equal(validateAdvertisement({ ...valid, imageFile: png() }, { requireImage: true }).imageFile, undefined)
  })
})

describe('what goes on the wire', () => {
  test('without a file it is plain JSON, trimmed', () => {
    const payload = buildAdvertisementPayload({ ...valid, name: '  Diwali offer  ', applyUrl: ' /apply ' })
    assert.deepEqual(payload, { name: 'Diwali offer', applyUrl: '/apply', applyButtonText: 'Apply Now' })
  })

  test('an empty button text falls back to Apply', () => {
    assert.equal(buildAdvertisementPayload({ ...valid, applyButtonText: '   ' }).applyButtonText, 'Apply')
  })

  test('with a file it is multipart, and the file field is named image', () => {
    const fd = buildAdvertisementPayload({ ...valid, imageFile: png() })
    assert.ok(fd instanceof FormData)
    assert.equal(fd.get('name'), 'Diwali offer')
    assert.equal(fd.get('applyUrl'), '/loan-application')
    assert.equal(fd.get('applyButtonText'), 'Apply Now')
    assert.ok(fd.get('image'))
  })

  test('never sends the fields the server owns', () => {
    const fd = buildAdvertisementPayload({ ...valid, imageFile: png() })
    for (const field of ['imageUrl', 'imageFileName', 'status', 'publishedAt']) {
      assert.equal(fd.has(field), false, field)
    }
    const json = buildAdvertisementPayload(valid)
    for (const field of ['imageUrl', 'imageFileName', 'status', 'publishedAt']) {
      assert.equal(field in json, false, field)
    }
  })
})

describe('error messages', () => {
  const withStatus = (status, data = {}) => ({ response: { status, data } })

  test('a server message is shown as it is', () => {
    assert.equal(
      advertisementError(withStatus(400, { message: 'Apply URL must be a page on this site' }), 'fallback'),
      'Apply URL must be a page on this site'
    )
  })

  test('a field error is preferred over the generic one', () => {
    const err = withStatus(400, { message: 'Validation failed', errors: [{ message: 'Name is required' }] })
    assert.equal(advertisementError(err, 'fallback'), 'Name is required')
  })

  test('the lifecycle statuses read as something an admin can act on', () => {
    assert.match(advertisementError(withStatus(403), 'x'), /role/i)
    assert.match(advertisementError(withStatus(401), 'x'), /sign in/i)
    assert.match(advertisementError(withStatus(404), 'x'), /no longer exists/i)
    assert.match(advertisementError(withStatus(409), 'x'), /published/i)
    assert.match(advertisementError(withStatus(500), 'x'), /try again/i)
  })

  test('no response at all is reported as a connection problem', () => {
    assert.match(advertisementError(new Error('Network Error'), 'x'), /connection/i)
  })

  test('falls back rather than surfacing a raw error', () => {
    assert.equal(advertisementError(withStatus(418), 'Failed to save advertisement'), 'Failed to save advertisement')
  })
})

describe('formatting', () => {
  test('sizes read in the units an admin expects', () => {
    assert.equal(formatBytes(512), '512 B')
    assert.equal(formatBytes(2048), '2 KB')
    assert.equal(formatBytes(MAX_IMAGE_BYTES), '5.0 MB')
    assert.equal(formatBytes(0), '')
  })
})
