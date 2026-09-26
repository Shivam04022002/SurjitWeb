// The analytics dashboard's own view of time.
//
// Reporting is in UTC, always — the same figure however the reader's machine is
// set. So the day strings the API sends are UTC calendar days, and everything
// here reads and renders them as such. Parsing them as local dates would shift
// every label by a day for anyone west of Greenwich.

export const TIMEZONE_LABEL = 'Timezone: GMT (UTC)'

// One global filter drives every section of the page. Each entry is a UTC
// calendar window the API resolves; the browser never computes a boundary.
export const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' }
]

export const PRESET_VALUES = PRESETS.map((p) => p.value)

// Today's UTC calendar day: the furthest a custom range may reach, and what the
// picker opens on. Taken from the ISO string rather than the local getters,
// which would give yesterday's date to anyone far enough east.
export const utcToday = () => new Date().toISOString().slice(0, 10)

// A UTC day string as a Date at UTC midnight, for formatting only.
export const parseDay = (day) => {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const UTC = { timeZone: 'UTC' }

export const formatRangeDay = (day) => parseDay(day).toLocaleDateString('en-GB', {
  ...UTC, day: 'numeric', month: 'short', year: 'numeric'
})

export const formatAxisDate = (day, long = false) => parseDay(day).toLocaleDateString('en-GB', long
  ? { ...UTC, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  : { ...UTC, day: 'numeric', month: 'short' })

// What the filter bar says the current window is.
export const rangeLabelOf = (data) => {
  if (!data?.from || !data?.to) return ''
  return data.from === data.to
    ? formatRangeDay(data.from)
    : `${formatRangeDay(data.from)} – ${formatRangeDay(data.to)}`
}

// What travels to the API. A preset is just its key; a custom window carries
// its two UTC days, which the server interprets as UTC boundaries.
export const rangeParams = ({ range = '7d', from, to } = {}) => (
  range === 'custom' ? { range, from, to } : { range }
)

// Whether a custom window can be applied: two real days, in order, and not
// reaching into the future. The API checks all of this again.
export const isValidCustomRange = ({ from, to } = {}) => {
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(String(from)) || !day.test(String(to))) return false
  if (from > to) return false
  return to <= utcToday()
}

// ── Traffic by City ──────────────────────────────────────────────────────────
//
// A visitor here is a session, placed on the city of its first page view —
// the same definition the rest of the dashboard uses. "Visitors" is therefore
// the right word for the column, and the one the API uses.

export const CITY_PAGE_SIZE = 25

// A city's share of everyone who visited in the window, unknown locations
// included — so the rows and the unknown bucket together account for all of
// them. Null when there is nobody to take a share of.
export const cityShare = (visitors, totalVisitors) => (
  totalVisitors > 0 ? visitors / totalVisitors : null
)

export const formatShare = (ratio) => (ratio == null ? '—' : `${(ratio * 100).toFixed(1)}%`)

// What the list's footer says about itself. Search narrows which cities are
// listed, never how they were counted, and the line says so.
export const citySummary = ({ total = 0, totalCities = 0, search = '' } = {}) => {
  if (!totalCities) return 'No city data in this period'
  const all = `${totalCities} ${totalCities === 1 ? 'city' : 'cities'}`
  if (!search) return all
  return `${total} of ${all} matching “${search}”`
}

// ── Hour of the UTC day ──────────────────────────────────────────────────────
//
// An hour on this page is an hour of the UTC day: 3 PM is 15:00–15:59 UTC to
// every reader, whatever their machine is set to. So an hour is carried as the
// number 0–23 and rendered from that number alone — never by formatting a Date,
// which would hand a reader in Lucknow "8:30 PM" for the same traffic.
//
// Over a window of several days that hour means that hour on each of them: Last
// 7 Days at 3 PM is seven 15:00–15:59 windows. The server does the matching;
// this only names the hour.

export const HOURS_IN_DAY = 24

// No hour chosen. Distinct from hour 0, which is midnight and a real answer.
export const ALL_HOURS = ''
export const ALL_CITIES = ''

export const hourLabel = (hour) => {
  const h = Number(hour)
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${twelve} ${h < 12 ? 'AM' : 'PM'}`
}

// The hour spelled out as the window it actually is, so nobody has to trust the
// 12-hour label alone.
export const hourWindowLabel = (hour) => {
  const h = String(Number(hour)).padStart(2, '0')
  return `${h}:00–${h}:59 UTC`
}

export const hourAxisLabel = (hour) => String(Number(hour)).padStart(2, '0')

export const HOUR_OPTIONS = [
  { value: ALL_HOURS, label: 'All Hours' },
  ...Array.from({ length: HOURS_IN_DAY }, (_, h) => ({ value: String(h), label: hourLabel(h) }))
]

// Whether an hour was chosen at all. Hour 0 has to pass this.
export const hasHour = (hour) => hour !== ALL_HOURS && hour !== null && hour !== undefined

// What travels to the API for the hourly city view: the window, the paging, and
// the two filters — each sent only when it narrows something.
export const cityHourlyParams = (range, {
  page = 1, limit = CITY_PAGE_SIZE, search = '', hour = ALL_HOURS, city = ALL_CITIES
} = {}) => {
  const params = { ...rangeParams(range), page, limit }
  if (search) params.search = search
  if (hasHour(hour)) params.hour = Number(hour)
  if (city) params.city = city
  return params
}

// Where the dashboard's "See All" goes. The window travels in the link, so the
// page opens on the period the card was showing rather than on a default of its
// own — and so the resulting URL can be shared or bookmarked as that view.
export const CITY_PAGE_PATH = '/analytics/cities'

export const cityPageLink = ({ range = '7d', from, to } = {}) => {
  const query = new URLSearchParams({ range })
  if (range === 'custom' && from && to) {
    query.set('from', from)
    query.set('to', to)
  }
  return `${CITY_PAGE_PATH}?${query.toString()}`
}

// The hour with the most visitors, for "which hour was busiest?". Null when
// nothing arrived at all — no hour won, rather than midnight winning by default.
export const busiestHour = (hourly = []) => {
  const seen = hourly.filter((h) => h.visitors > 0)
  if (!seen.length) return null
  return seen.reduce((best, h) => (h.visitors > best.visitors ? h : best))
}

// What the page says the current selection is, above the city table.
export const hourScopeLabel = ({ hour, city } = {}) => {
  const when = hasHour(hour) ? `${hourLabel(hour)} · ${hourWindowLabel(hour)}` : 'All hours'
  return city ? `${when} · ${city}` : when
}

// The one-line summary under the hourly chart: what the chosen hour holds.
export const hourSelectionSummary = ({ hour, visitors = 0, cities = 0 } = {}) => {
  if (!hasHour(hour)) return 'Every hour of the UTC day. Select one to narrow the cities below.'
  const people = `${visitors} ${visitors === 1 ? 'visitor' : 'visitors'}`
  const places = `${cities} ${cities === 1 ? 'city' : 'cities'}`
  return visitors ? `${people} across ${places}` : 'No visitors in this hour'
}
