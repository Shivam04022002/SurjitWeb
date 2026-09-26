// The Traffic by City "See All" view.
//
// The dialog's behaviour is decided by these pure functions and by what the
// service asks the API for: which window, which page, which search term, and
// what each row is a share of. Those are what these tests pin down — the
// counts themselves are the API's, and are covered by the backend suite.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  CITY_PAGE_SIZE, cityShare, formatShare, citySummary,
  rangeParams, TIMEZONE_LABEL
} from './analyticsRange.js'

// What the admin service builds for a cities request, mirroring its own logic
// so the assertions are about the request, not about axios.
const cityRequest = (range, { page = 1, limit = CITY_PAGE_SIZE, search = '' } = {}) => {
  const params = { ...rangeParams(range), page, limit }
  if (search) params.search = search
  return params
}

// A window as the API returns it.
const windowOf = (over = {}) => ({
  rows: [
    { city: 'Mountain View', country: 'United States', visitors: 12 },
    { city: 'Lucknow', country: 'India', visitors: 8 },
    { city: 'Mumbai', country: 'India', visitors: 7 }
  ],
  total: 3,
  totalCities: 15,
  visitors: 60,
  knownVisitors: 46,
  unknownVisitors: 14,
  search: '',
  ...over
})

describe('the card and the full list agree on what a visitor is', () => {
  test('a page size is set, and it is the CMS default', () => {
    assert.equal(CITY_PAGE_SIZE, 25)
  })

  test('the window is stated in UTC wherever the list is shown', () => {
    assert.equal(TIMEZONE_LABEL, 'Timezone: GMT (UTC)')
  })
})

describe('each row is a share of everyone who visited', () => {
  test('a share counts against all visitors, unknown locations included', () => {
    // 12 of 60, not 12 of the 46 with a known city: the rows and the unknown
    // bucket together account for everyone.
    assert.equal(cityShare(12, 60), 0.2)
    assert.equal(formatShare(cityShare(12, 60)), '20.0%')
  })

  test('the unknown bucket takes its own share, on the same basis', () => {
    assert.equal(formatShare(cityShare(14, 60)), '23.3%')
  })

  test('the shares of every city plus unknown come to a hundred percent', () => {
    const data = windowOf()
    const cityTotal = data.knownVisitors
    const share = (n) => cityShare(n, data.visitors)
    assert.equal(share(cityTotal) + share(data.unknownVisitors), 1)
  })

  test('an empty window has no share to show, rather than zero percent', () => {
    assert.equal(cityShare(0, 0), null)
    assert.equal(formatShare(cityShare(0, 0)), '—')
    assert.equal(formatShare(null), '—')
  })
})

describe('what the list says about itself', () => {
  test('with no search it names how many cities there are', () => {
    assert.equal(citySummary({ total: 15, totalCities: 15 }), '15 cities')
    assert.equal(citySummary({ total: 1, totalCities: 1 }), '1 city')
  })

  test('with a search it says how many matched, of how many there are', () => {
    assert.equal(
      citySummary({ total: 2, totalCities: 15, search: 'mumbai' }),
      '2 of 15 cities matching “mumbai”'
    )
  })

  test('an empty window says so plainly', () => {
    assert.equal(citySummary({ total: 0, totalCities: 0 }), 'No city data in this period')
    assert.equal(citySummary({}), 'No city data in this period')
    assert.equal(citySummary(), 'No city data in this period')
  })

  test('a search matching nothing still reports the window honestly', () => {
    assert.equal(
      citySummary({ total: 0, totalCities: 15, search: 'atlantis' }),
      '0 of 15 cities matching “atlantis”'
    )
  })
})

describe('what the dialog asks the API for', () => {
  test('it asks for the window the dashboard is on, not a window of its own', () => {
    assert.deepEqual(cityRequest({ range: 'today' }), { range: 'today', page: 1, limit: 25 })
    assert.deepEqual(cityRequest({ range: 'yesterday' }), { range: 'yesterday', page: 1, limit: 25 })
    assert.deepEqual(cityRequest({ range: '30d' }), { range: '30d', page: 1, limit: 25 })
  })

  test('a custom window carries its two UTC days through', () => {
    assert.deepEqual(
      cityRequest({ range: 'custom', from: '2026-01-10', to: '2026-01-12' }),
      { range: 'custom', from: '2026-01-10', to: '2026-01-12', page: 1, limit: 25 }
    )
  })

  test('changing the global filter changes the request, and nothing else does', () => {
    const today = cityRequest({ range: 'today' })
    const week = cityRequest({ range: '7d' })
    assert.notDeepEqual(today, week)
    assert.equal(today.page, week.page, 'the page is not what changed')
  })

  test('a page is one-based on the wire, whatever the table shows', () => {
    assert.equal(cityRequest({ range: '7d' }, { page: 1 }).page, 1)
    assert.equal(cityRequest({ range: '7d' }, { page: 3 }).page, 3)
  })

  test('a page size travels with the request', () => {
    assert.equal(cityRequest({ range: '7d' }, { limit: 50 }).limit, 50)
    assert.equal(cityRequest({ range: '7d' }, { limit: 100 }).limit, 100)
  })

  test('a search term is sent only when there is one', () => {
    assert.equal('search' in cityRequest({ range: '7d' }), false)
    assert.equal('search' in cityRequest({ range: '7d' }, { search: '' }), false)
    assert.equal(cityRequest({ range: '7d' }, { search: 'mountain' }).search, 'mountain')
  })

  test('searching never changes the window being asked about', () => {
    const plain = cityRequest({ range: 'custom', from: '2026-01-10', to: '2026-01-12' })
    const searched = cityRequest({ range: 'custom', from: '2026-01-10', to: '2026-01-12' }, { search: 'mumbai' })
    assert.equal(searched.range, plain.range)
    assert.equal(searched.from, plain.from)
    assert.equal(searched.to, plain.to)
  })
})

describe('rows as the dialog renders them', () => {
  test('a country is shown when the lookup resolved one', () => {
    const rows = windowOf().rows
    assert.equal(rows.find((r) => r.city === 'Lucknow').country, 'India')
  })

  test('a city with no country is a row all the same', () => {
    const row = { city: 'Somewhere', country: null, visitors: 3 }
    assert.equal(row.country, null, 'rendered as an em dash, not dropped')
    assert.equal(formatShare(cityShare(row.visitors, 60)), '5.0%')
  })

  test('the numbering continues across pages', () => {
    const numberOn = (page, rowsPerPage, i) => page * rowsPerPage + i + 1
    assert.equal(numberOn(0, 25, 0), 1)
    assert.equal(numberOn(0, 25, 24), 25)
    assert.equal(numberOn(1, 25, 0), 26)
    assert.equal(numberOn(2, 50, 3), 104)
  })
})
