import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseModelList, formatModelList } from './modelList.js'

test('splits on commas and line breaks, trimming each name', () => {
  assert.deepEqual(parseModelList(' gemini-3.1-flash-lite ,gemini-3.5-flash-lite\n gemini-flash-lite-latest '),
    ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'])
})

test('drops empty entries only; nothing is added, reordered or deduplicated', () => {
  assert.deepEqual(parseModelList('b, a,, a,'), ['b', 'a', 'a'])
  assert.deepEqual(parseModelList(''), [])
  assert.deepEqual(parseModelList('  ,  '), [])
  assert.deepEqual(parseModelList(undefined), [])
})

test('formats a saved list back into the field', () => {
  assert.equal(formatModelList(['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']), 'gemini-3.1-flash-lite, gemini-3.5-flash-lite')
  assert.equal(formatModelList(undefined), '')
  assert.deepEqual(parseModelList(formatModelList(['x-1', 'y-2'])), ['x-1', 'y-2'])
})
