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

// What the dialog's footer says about the list being shown. Search narrows
// which cities are listed, never how they were counted, and the line says so.
export const citySummary = ({ total = 0, totalCities = 0, search = '' } = {}) => {
  if (!totalCities) return 'No city data in this period'
  const all = `${totalCities} ${totalCities === 1 ? 'city' : 'cities'}`
  if (!search) return all
  return `${total} of ${all} matching “${search}”`
}
