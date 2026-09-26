// Traffic by City, hour by hour.
//
// What the page does is decided by these pure functions: which hour is named,
// what window that hour is, what the request asks for, and where the dashboard's
// "See All" goes. The counts are the API's and are covered by the backend suite;
// what is covered here is that an hour on this page is an hour of the UTC day
// and is never formatted from the reader's clock.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  HOURS_IN_DAY, ALL_HOURS, ALL_CITIES, HOUR_OPTIONS,
  hourLabel, hourWindowLabel, hourAxisLabel, hasHour,
  cityHourlyParams, busiestHour, hourScopeLabel, hourSelectionSummary,
  cityPageLink, CITY_PAGE_PATH, CITY_PAGE_SIZE, TIMEZONE_LABEL
} from './analyticsRange.js'

const hourly = (pairs) => Array.from({ length: HOURS_IN_DAY }, (_, h) => ({
  hour: h, visitors: pairs[h] || 0, pageViews: (pairs[h] || 0) * 2
}))

describe('an hour is an hour of the UTC day', () => {
  test('every hour of the day is offered, plus "all"', () => {
    assert.equal(HOURS_IN_DAY, 24)
    assert.equal(HOUR_OPTIONS.length, 25)
    assert.equal(HOUR_OPTIONS[0].label, 'All Hours')
    assert.equal(HOUR_OPTIONS[0].value, ALL_HOURS)
    assert.deepEqual(
      HOUR_OPTIONS.slice(1).map((o) => o.value),
      Array.from({ length: 24 }, (_, h) => String(h))
    )
  })

  test('3 PM is hour 15, and says which window that is', () => {
    assert.equal(hourLabel(15), '3 PM')
    assert.equal(hourWindowLabel(15), '15:00–15:59 UTC')
  })

  test('midnight and noon are named correctly, not as hour zero and twelve', () => {
    assert.equal(hourLabel(0), '12 AM')
    assert.equal(hourLabel(12), '12 PM')
    assert.equal(hourWindowLabel(0), '00:00–00:59 UTC')
    assert.equal(hourWindowLabel(12), '12:00–12:59 UTC')
  })

  test('the last hour of the day reaches 23:59', () => {
    assert.equal(hourLabel(23), '11 PM')
    assert.equal(hourWindowLabel(23), '23:00–23:59 UTC')
  })

  test('every label is one of the twelve, twice, and in order', () => {
    assert.deepEqual(
      Array.from({ length: 24 }, (_, h) => hourLabel(h)),
      ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
        '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM']
    )
  })

  test('the axis is two digits, so the columns line up', () => {
    assert.equal(hourAxisLabel(0), '00')
    assert.equal(hourAxisLabel(9), '09')
    assert.equal(hourAxisLabel(15), '15')
  })

  // The whole point. 15:00 UTC is 20:30 where this business sits; a label built
  // from a Date would read "8:30 PM" on a machine set to IST and the page would
  // be quietly wrong about when its traffic arrived.
  test('a label is built from the number, never from a Date', () => {
    const asDate = new Date(Date.UTC(2026, 0, 15, 15, 0, 0))
    const localHour = asDate.getHours() // whatever this machine happens to be
    assert.equal(hourLabel(15), '3 PM', 'the hour is named from 15, not from a clock')
    assert.equal(hourWindowLabel(15), '15:00–15:59 UTC')
    if (localHour !== 15) {
      assert.notEqual(hourLabel(15), hourLabel(localHour),
        'a locally-read hour would have produced a different label')
    }
  })

  test('the page states its timezone', () => {
    assert.equal(TIMEZONE_LABEL, 'Timezone: GMT (UTC)')
  })
})

describe('choosing an hour, and choosing none', () => {
  test('no hour chosen is not the same as midnight', () => {
    assert.equal(hasHour(ALL_HOURS), false)
    assert.equal(hasHour(''), false)
    assert.equal(hasHour(null), false)
    assert.equal(hasHour(undefined), false)
    assert.equal(hasHour('0'), true, 'midnight is a real choice')
    assert.equal(hasHour(0), true)
    assert.equal(hasHour('15'), true)
  })
})

describe('what the page asks the API for', () => {
  test('the window travels, and the paging with it', () => {
    assert.deepEqual(
      cityHourlyParams({ range: 'today' }),
      { range: 'today', page: 1, limit: 25 }
    )
    assert.equal(CITY_PAGE_SIZE, 25)
  })

  test('a custom window carries its two UTC days', () => {
    assert.deepEqual(
      cityHourlyParams({ range: 'custom', from: '2026-01-10', to: '2026-01-12' }),
      { range: 'custom', from: '2026-01-10', to: '2026-01-12', page: 1, limit: 25 }
    )
  })

  test('an hour is sent as a number, only when one is chosen', () => {
    assert.equal('hour' in cityHourlyParams({ range: '7d' }), false)
    assert.equal('hour' in cityHourlyParams({ range: '7d' }, { hour: ALL_HOURS }), false)
    assert.equal(cityHourlyParams({ range: '7d' }, { hour: '15' }).hour, 15)
    assert.equal(cityHourlyParams({ range: '7d' }, { hour: 15 }).hour, 15)
  })

  test('midnight is sent, not dropped as falsy', () => {
    const params = cityHourlyParams({ range: '7d' }, { hour: '0' })
    assert.equal('hour' in params, true)
    assert.equal(params.hour, 0)
  })

  test('a city is sent only when one is chosen', () => {
    assert.equal('city' in cityHourlyParams({ range: '7d' }), false)
    assert.equal('city' in cityHourlyParams({ range: '7d' }, { city: ALL_CITIES }), false)
    assert.equal(cityHourlyParams({ range: '7d' }, { city: 'Lucknow' }).city, 'Lucknow')
  })

  test('a search term is sent only when there is one', () => {
    assert.equal('search' in cityHourlyParams({ range: '7d' }), false)
    assert.equal(cityHourlyParams({ range: '7d' }, { search: 'mountain' }).search, 'mountain')
  })

  test('the hour and the city narrow the same window, never a different one', () => {
    const base = { range: 'custom', from: '2026-01-10', to: '2026-01-12' }
    const narrowed = cityHourlyParams(base, { hour: '15', city: 'Lucknow', search: 'luck' })
    assert.equal(narrowed.range, 'custom')
    assert.equal(narrowed.from, '2026-01-10')
    assert.equal(narrowed.to, '2026-01-12')
  })

  test('a page and a page size travel as asked', () => {
    assert.equal(cityHourlyParams({ range: '7d' }, { page: 3 }).page, 3)
    for (const limit of [25, 50, 100]) {
      assert.equal(cityHourlyParams({ range: '7d' }, { limit }).limit, limit)
    }
  })
})

describe('the busiest hour', () => {
  test('is the one with the most visitors', () => {
    const peak = busiestHour(hourly({ 9: 3, 15: 11, 20: 7 }))
    assert.equal(peak.hour, 15)
    assert.equal(peak.visitors, 11)
  })

  test('an empty period has no busiest hour, rather than midnight by default', () => {
    assert.equal(busiestHour(hourly({})), null)
    assert.equal(busiestHour([]), null)
    assert.equal(busiestHour(), null)
  })

  test('midnight can win when midnight is busiest', () => {
    assert.equal(busiestHour(hourly({ 0: 9, 15: 2 })).hour, 0)
  })

  test('a tie keeps the earlier hour, so the answer is stable', () => {
    assert.equal(busiestHour(hourly({ 8: 5, 17: 5 })).hour, 8)
  })
})

describe('what the page says the selection is', () => {
  test('with no hour and no city, it says so plainly', () => {
    assert.equal(hourScopeLabel({ hour: ALL_HOURS }), 'All hours')
    assert.equal(hourScopeLabel({}), 'All hours')
    assert.equal(hourScopeLabel(), 'All hours')
  })

  test('an hour is named and spelled out', () => {
    assert.equal(hourScopeLabel({ hour: '15' }), '3 PM · 15:00–15:59 UTC')
    assert.equal(hourScopeLabel({ hour: '0' }), '12 AM · 00:00–00:59 UTC')
  })

  test('a city joins the hour when both are chosen', () => {
    assert.equal(hourScopeLabel({ hour: '15', city: 'Lucknow' }), '3 PM · 15:00–15:59 UTC · Lucknow')
    assert.equal(hourScopeLabel({ hour: ALL_HOURS, city: 'Lucknow' }), 'All hours · Lucknow')
  })

  test('the summary under the chart counts visitors and cities, separately', () => {
    assert.equal(hourSelectionSummary({ hour: '15', visitors: 47, cities: 8 }), '47 visitors across 8 cities')
    assert.equal(hourSelectionSummary({ hour: '15', visitors: 1, cities: 1 }), '1 visitor across 1 city')
  })

  test('an empty hour says nobody came, not zero of something', () => {
    assert.equal(hourSelectionSummary({ hour: '15', visitors: 0, cities: 0 }), 'No visitors in this hour')
  })

  test('with no hour it invites one to be chosen', () => {
    assert.match(hourSelectionSummary({ hour: ALL_HOURS }), /Every hour of the UTC day/)
  })
})

describe('See All goes to a page, not a dialog', () => {
  test('the link is a route, carrying the window the card was showing', () => {
    assert.equal(CITY_PAGE_PATH, '/analytics/cities')
    assert.equal(cityPageLink({ range: '30d' }), '/analytics/cities?range=30d')
    assert.equal(cityPageLink({ range: 'today' }), '/analytics/cities?range=today')
  })

  test('a custom window survives the navigation', () => {
    assert.equal(
      cityPageLink({ range: 'custom', from: '2026-01-10', to: '2026-01-12' }),
      '/analytics/cities?range=custom&from=2026-01-10&to=2026-01-12'
    )
  })

  test('an incomplete custom window falls back rather than linking to nonsense', () => {
    assert.equal(cityPageLink({ range: 'custom' }), '/analytics/cities?range=custom')
    assert.equal(cityPageLink(), '/analytics/cities?range=7d')
  })
})
