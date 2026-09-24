// What the advertisement save actually puts on the wire.
//
// This exists because of a production bug: the page built a correct FormData
// with the image in it, and the request still went out as JSON with
// "image":{} — the file never left the browser, and the save reported success.
// The cause was the shared api client's default `Content-Type: application/json`,
// which axios takes literally: given a FormData and a JSON content type it
// serialises the form to JSON, and a File becomes an empty object.
//
// So this test sends through a real axios instance configured exactly like
// admin/src/services/api.js, against a real HTTP server, and inspects the bytes.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import axios from 'axios'
import { buildAdvertisementPayload, requestConfig } from './advertisementUtils.js'

let server
let captured = []
let baseURL

// The admin client's configuration, reproduced: this default is the whole
// reason the bug existed.
const client = () => axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' }
})

const pngFile = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' })

const form = (extra = {}) => ({
    name: 'Diwali offer',
    applyUrl: '/loan-application',
    applyButtonText: 'Apply Now',
    imageFile: null,
    ...extra
})

before(async () => {
    server = http.createServer((req, res) => {
        // Read as latin1 so the PNG bytes survive intact and the ASCII field
        // names and values still read normally.
        req.setEncoding('latin1')
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
            captured.push({
                method: req.method,
                url: req.url,
                contentType: req.headers['content-type'] || '',
                body
            })
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, data: { advertisement: {} } }))
        })
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    baseURL = `http://127.0.0.1:${server.address().port}/api`
})

after(() => server?.close())

const send = async (payload, { method = 'put' } = {}) => {
    captured = []
    const api = client()
    // Exactly what advertisement.service.js does.
    await api[method]('/v1/advertisements/abc', payload, requestConfig(payload))
    return captured[0]
}

describe('saving an advertisement with a picked image', () => {
    test('goes out as multipart, with a boundary the browser generated', async () => {
        const sent = await send(buildAdvertisementPayload(form({ imageFile: pngFile() })))
        assert.match(sent.contentType, /^multipart\/form-data; *boundary=.+/, sent.contentType)
    })

    test('carries the file itself, under the field name the server reads', async () => {
        const sent = await send(buildAdvertisementPayload(form({ imageFile: pngFile() })))
        const body = sent.body
        assert.match(body, /name="image"/, 'the file part is named image')
        assert.ok(body.includes('\x89PNG'), 'the PNG bytes are in the request')
        assert.match(body, /Content-Type: image\/png/)
    })

    test('carries the text fields alongside it', async () => {
        const sent = await send(buildAdvertisementPayload(form({ imageFile: pngFile() })))
        const body = sent.body
        for (const [field, value] of [['name', 'Diwali offer'], ['applyUrl', '/loan-application'], ['applyButtonText', 'Apply Now']]) {
            assert.match(body, new RegExp(`name="${field}"`), field)
            assert.ok(body.includes(value), `${field} value`)
        }
    })

    test('never serialises the file away into JSON — the bug this test exists for', async () => {
        const sent = await send(buildAdvertisementPayload(form({ imageFile: pngFile() })))
        assert.doesNotMatch(sent.contentType, /application\/json/)
        assert.ok(!sent.body.includes('"image":{}'), 'the File must not become an empty object')
    })

    test('the same holds when creating', async () => {
        const sent = await send(buildAdvertisementPayload(form({ imageFile: pngFile() })), { method: 'post' })
        assert.match(sent.contentType, /^multipart\/form-data/)
        assert.match(sent.body, /name="image"/)
    })
})

describe('saving without picking an image', () => {
    test('goes out as plain JSON, with no image field at all', async () => {
        const sent = await send(buildAdvertisementPayload(form()))
        assert.match(sent.contentType, /application\/json/)
        const body = JSON.parse(sent.body)
        assert.deepEqual(body, { name: 'Diwali offer', applyUrl: '/loan-application', applyButtonText: 'Apply Now' })
        assert.equal('image' in body, false, 'the server keeps the existing artwork when no field arrives')
    })

    test('and still never sends the fields the server owns', async () => {
        const sent = await send(buildAdvertisementPayload(form()))
        const body = sent.body
        for (const field of ['imageUrl', 'imageFileName', 'status', 'publishedAt']) {
            assert.ok(!body.includes(field), field)
        }
    })
})

describe('the request configuration itself', () => {
    test('multipart is declared for a FormData payload', () => {
        const fd = buildAdvertisementPayload(form({ imageFile: pngFile() }))
        assert.deepEqual(requestConfig(fd), { headers: { 'Content-Type': 'multipart/form-data' } })
    })

    test('and left to the client default for a plain object', () => {
        assert.equal(requestConfig(buildAdvertisementPayload(form())), undefined)
        assert.equal(requestConfig(undefined), undefined)
    })
})
