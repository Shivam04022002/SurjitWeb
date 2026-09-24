// What the popup will and will not show. Everything here is a decision made
// before a single pixel is rendered, which is why it can be tested without a
// browser.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
    displayableAdvertisement, advertisementFromResponse,
    isUsableImageUrl, isUsableApplyUrl, isInternalApplyUrl,
    seenKey, hasSeenAdvertisement, markAdvertisementSeen
} from './advertisementModel.js'

const AD = {
    id: '6720f1c2a4b5c6d7e8f90123',
    name: 'Diwali offer',
    imageUrl: 'https://cdn.example.com/advertisements/diwali.png',
    applyUrl: '/loan-application',
    applyButtonText: 'Apply now'
}

describe('a complete advertisement', () => {
    test('is shown, with its fields carried through', () => {
        assert.deepEqual(displayableAdvertisement(AD), AD)
    })

    test('an external apply link is fine', () => {
        const ad = displayableAdvertisement({ ...AD, applyUrl: 'https://surjitfinance.com/apply' })
        assert.equal(ad.applyUrl, 'https://surjitfinance.com/apply')
        assert.equal(isInternalApplyUrl(ad.applyUrl), false)
        assert.equal(isInternalApplyUrl('/loan-application'), true)
    })

    test('surrounding whitespace is trimmed rather than rendered', () => {
        const ad = displayableAdvertisement({ ...AD, name: '  Diwali offer  ', applyUrl: ' /loan-application ' })
        assert.equal(ad.name, 'Diwali offer')
        assert.equal(ad.applyUrl, '/loan-application')
    })

    test('an empty button text falls back to Apply, and nothing else is invented', () => {
        assert.equal(displayableAdvertisement({ ...AD, applyButtonText: '   ' }).applyButtonText, 'Apply')
        assert.equal(displayableAdvertisement({ ...AD, applyButtonText: undefined }).applyButtonText, 'Apply')
    })
})

describe('nothing is shown when the advertisement is unusable', () => {
    test('no advertisement at all', () => {
        for (const value of [null, undefined, '', 0, 'advertisement', []]) {
            assert.equal(displayableAdvertisement(value), null, String(value))
        }
    })

    test('a missing required field', () => {
        for (const field of ['id', 'name', 'imageUrl', 'applyUrl']) {
            assert.equal(displayableAdvertisement({ ...AD, [field]: '' }), null, field)
            assert.equal(displayableAdvertisement({ ...AD, [field]: undefined }), null, field)
            assert.equal(displayableAdvertisement({ ...AD, [field]: '   ' }), null, `${field} (blank)`)
        }
    })

    test('a field of the wrong type', () => {
        assert.equal(displayableAdvertisement({ ...AD, name: { first: 'Diwali' } }), null)
        assert.equal(displayableAdvertisement({ ...AD, imageUrl: 42 }), null)
        assert.equal(displayableAdvertisement({ ...AD, applyUrl: ['/loan-application'] }), null)
    })

    test('an image address the popup will not load', () => {
        for (const imageUrl of ['javascript:alert(1)', 'data:image/png;base64,AAA', '//evil.example.com/x.png', 'not a url']) {
            assert.equal(isUsableImageUrl(imageUrl), false, imageUrl)
            assert.equal(displayableAdvertisement({ ...AD, imageUrl }), null, imageUrl)
        }
    })

    test('an apply link the popup will not follow', () => {
        for (const applyUrl of ['javascript:alert(1)', 'data:text/html,<script>', 'mailto:someone@example.com', '//evil.example.com', 'nonsense']) {
            assert.equal(isUsableApplyUrl(applyUrl), false, applyUrl)
            assert.equal(displayableAdvertisement({ ...AD, applyUrl }), null, applyUrl)
        }
    })

    test('a site-relative image is accepted; the site serves its own uploads', () => {
        assert.equal(isUsableImageUrl('/uploads/advertisements/diwali.png'), true)
        assert.ok(displayableAdvertisement({ ...AD, imageUrl: '/uploads/advertisements/diwali.png' }))
    })
})

describe('the API response', () => {
    test('the envelope is unwrapped', () => {
        assert.deepEqual(advertisementFromResponse({ advertisement: AD }), AD)
    })

    test('an explicit null advertisement means nothing to show', () => {
        assert.equal(advertisementFromResponse({ advertisement: null }), null)
    })

    test('a malformed response means nothing to show, never a throw', () => {
        for (const payload of [null, undefined, 'oops', 42, [], { data: {} }, { advertisement: 'yes' }]) {
            assert.equal(advertisementFromResponse(payload), null, JSON.stringify(payload))
        }
    })

    test('an advertisement passed without its envelope still works', () => {
        assert.deepEqual(advertisementFromResponse(AD), AD)
    })

    test('the fields the public API deliberately withholds are never required', () => {
        // The popup must not start depending on anything the backend excludes.
        const ad = advertisementFromResponse({ advertisement: AD })
        for (const field of ['imageFileName', 'status', 'publishedAt', 'createdAt', 'updatedAt', '_id']) {
            assert.equal(field in ad, false, field)
        }
    })
})


// ── Once per browser session ──────────────────────────────────────────────────
describe('remembering that an advertisement was shown', () => {
    // A stand-in for sessionStorage, which Node does not have. `fail` makes it
    // behave like a browser with storage switched off.
    const fakeStorage = ({ fail = false } = {}) => {
        const store = new Map()
        return {
            store,
            getItem: (k) => { if (fail) throw new DOMException('denied'); return store.has(k) ? store.get(k) : null },
            setItem: (k, v) => { if (fail) throw new DOMException('denied'); store.set(k, String(v)) },
            removeItem: (k) => { if (fail) throw new DOMException('denied'); store.delete(k) }
        }
    }

    const withStorage = (storage, fn) => {
        const previous = globalThis.window
        globalThis.window = { sessionStorage: storage }
        try { return fn() } finally { globalThis.window = previous }
    }

    test('the key carries the advertisement id, never a global flag', () => {
        assert.equal(seenKey(AD.id), `sf_ad_seen_${AD.id}`)
        assert.notEqual(seenKey('A'), seenKey('B'))
    })

    test('an advertisement starts unseen, and is remembered once marked', () => {
        const storage = fakeStorage()
        withStorage(storage, () => {
            assert.equal(hasSeenAdvertisement(AD.id), false)
            assert.equal(markAdvertisementSeen(AD.id), true)
            assert.equal(hasSeenAdvertisement(AD.id), true)
            assert.equal(storage.store.get(`sf_ad_seen_${AD.id}`), '1')
            assert.equal(storage.store.size, 1, 'one key, for this advertisement only')
        })
    })

    test('a different advertisement is still shown', () => {
        withStorage(fakeStorage(), () => {
            markAdvertisementSeen('advertisement-A')
            assert.equal(hasSeenAdvertisement('advertisement-A'), true)
            assert.equal(hasSeenAdvertisement('advertisement-B'), false, 'a newly published advertisement may appear')
        })
    })

    test('marking twice is harmless', () => {
        const storage = fakeStorage()
        withStorage(storage, () => {
            markAdvertisementSeen(AD.id)
            markAdvertisementSeen(AD.id)
            assert.equal(storage.store.size, 1)
        })
    })

    test('storage that is switched off never throws, and never blocks the site', () => {
        withStorage(fakeStorage({ fail: true }), () => {
            // Reading fails open: the visitor counts as not having seen it.
            assert.equal(hasSeenAdvertisement(AD.id), false)
            // Writing fails quietly, and says so rather than pretending.
            assert.equal(markAdvertisementSeen(AD.id), false)
            assert.equal(hasSeenAdvertisement(AD.id), false)
        })
    })

    test('no storage object at all is survivable', () => {
        withStorage(undefined, () => {
            assert.equal(hasSeenAdvertisement(AD.id), false)
            assert.equal(markAdvertisementSeen(AD.id), false)
        })
    })

    test('an advertisement with no id is never recorded', () => {
        const storage = fakeStorage()
        withStorage(storage, () => {
            assert.equal(hasSeenAdvertisement(''), false)
            assert.equal(markAdvertisementSeen(''), false)
            assert.equal(markAdvertisementSeen(undefined), false)
            assert.equal(storage.store.size, 0)
        })
    })

    test('nothing is written for a response the popup refused to show', () => {
        const storage = fakeStorage()
        withStorage(storage, () => {
            // The popup only ever marks what it displayed; an unusable
            // response never reaches that point.
            const unusable = displayableAdvertisement({ ...AD, imageUrl: '' })
            assert.equal(unusable, null)
            assert.equal(storage.store.size, 0)
        })
    })
})
