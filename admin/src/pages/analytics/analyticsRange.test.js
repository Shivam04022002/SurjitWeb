// The dashboard's time handling.
//
// Analytics is reported in UTC, so these assert that the browser's own
// timezone never enters into a boundary or a label. The tests run the process
// under several TZ settings to prove it.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESETS, PRESET_VALUES, TIMEZONE_LABEL,
  utcToday, parseDay, formatRangeDay, formatAxisDate, rangeLabelOf,
  rangeParams, isValidCustomRange
} from './analyticsRange.js'

// Runs a function with the process pinned to a timezone, so a UTC claim is
// tested somewhere other than UTC.
const inTimezone = (tz, fn) => {
  const previous = process.env.TZ
  process.env.TZ = tz
  try { return fn() } finally { process.env.TZ = previous }
}

const ZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']

describe('the filter offers the windows the dashboard promises', () => {
  test('Today, Yesterday, Last 7 Days, Last 30 Days are all present', () => {
    assert.deepEqual(PRESET_VALUES, ['today', 'yesterday', '7d', '30d', '90d'])
    assert.deepEqual(
      PRESETS.map((p) => p.label),
      ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days']
    )
  })

  test('the timezone is stated in words, not as a zone id', () => {
    assert.equal(TIMEZONE_LABEL, 'Timezone: GMT (UTC)')
  })
})

describe('days are UTC calendar days', () => {
  test('a day string parses to midnight UTC, in any browser timezone', () => {
    for (const tz of ZONES) {
      inTimezone(tz, () => {
        assert.equal(parseDay('2026-01-15').toISOString(), '2026-01-15T00:00:00.000Z', tz)
      })
    }
  })

  test('a label reads as the date the API meant, in any browser timezone', () => {
    for (const tz of ZONES) {
      inTimezone(tz, () => {
        // Parsed as a local date, this would read as 14 Jan west of Greenwich.
        assert.equal(formatRangeDay('2026-01-15'), '15 Jan 2026', tz)
        assert.equal(formatAxisDate('2026-01-15'), '15 Jan', tz)
        assert.match(formatAxisDate('2026-01-15', true), /15 Jan 2026/, tz)
      })
    }
  })

  test('the first and last day of a year do not drift', () => {
    for (const tz of ZONES) {
      inTimezone(tz, () => {
        assert.equal(formatRangeDay('2026-01-01'), '1 Jan 2026', tz)
        assert.equal(formatRangeDay('2026-12-31'), '31 Dec 2026', tz)
      })
    }
  })

  test("today is the UTC calendar day, taken from the ISO string", () => {
    const expected = new Date().toISOString().slice(0, 10)
    for (const tz of ZONES) {
      inTimezone(tz, () => assert.equal(utcToday(), expected, tz))
    }
    assert.match(utcToday(), /^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('the label for the active window', () => {
  test('a single day shows once, not as a range', () => {
    assert.equal(rangeLabelOf({ from: '2026-03-10', to: '2026-03-10' }), '10 Mar 2026')
  })

  test('a window shows both ends', () => {
    assert.equal(
      rangeLabelOf({ from: '2026-03-01', to: '2026-03-10' }),
      '1 Mar 2026 – 10 Mar 2026'
    )
  })

  test('no data yet is an empty label rather than a broken one', () => {
    assert.equal(rangeLabelOf(null), '')
    assert.equal(rangeLabelOf({}), '')
    assert.equal(rangeLabelOf({ from: '2026-03-01' }), '')
  })
})

describe('what is sent to the API', () => {
  test('a preset sends only its key', () => {
    assert.deepEqual(rangeParams({ range: 'yesterday' }), { range: 'yesterday' })
    assert.deepEqual(rangeParams({ range: '30d' }), { range: '30d' })
  })

  test('the default window is seven days', () => {
    assert.deepEqual(rangeParams(), { range: '7d' })
    assert.deepEqual(rangeParams({}), { range: '7d' })
  })

  test('a custom window sends its two UTC days', () => {
    assert.deepEqual(
      rangeParams({ range: 'custom', from: '2026-01-10', to: '2026-01-12' }),
      { range: 'custom', from: '2026-01-10', to: '2026-01-12' }
    )
  })

  test('a preset never carries stray dates', () => {
    assert.deepEqual(rangeParams({ range: 'today', from: '2026-01-10', to: '2026-01-12' }), { range: 'today' })
  })
})

describe('a custom window is checked before it is applied', () => {
  test('two real days in order are fine', () => {
    assert.equal(isValidCustomRange({ from: '2026-01-10', to: '2026-01-12' }), true)
    assert.equal(isValidCustomRange({ from: '2026-01-10', to: '2026-01-10' }), true)
  })

  test('the wrong way round is refused', () => {
    assert.equal(isValidCustomRange({ from: '2026-01-12', to: '2026-01-10' }), false)
  })

  test('the future is refused, judged by the UTC day', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    assert.equal(isValidCustomRange({ from: utcToday(), to: tomorrow }), false)
    assert.equal(isValidCustomRange({ from: utcToday(), to: utcToday() }), true)
  })

  test('anything that is not a day is refused', () => {
    for (const bad of [{}, { from: '', to: '' }, { from: '10-01-2026', to: '12-01-2026' }, { from: null, to: null }]) {
      assert.equal(isValidCustomRange(bad), false, JSON.stringify(bad))
    }
  })
})
