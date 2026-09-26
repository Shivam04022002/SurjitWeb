// Traffic by City — where the city figures are read in detail, by hour.
//
// The dashboard card answers "which cities?". This page answers "when?": how
// much traffic arrived at 3 PM, which cities it came from, what that hour looks
// like across a week, and which hour is busiest. It is a page rather than a
// dialog because those are questions worth a URL, a back button and room to
// read — and because a dialog cannot hold a chart, a filter bar and a paged
// table without becoming a page badly.
//
// Every hour here is an hour of the UTC day. 3 PM is 15:00–15:59 UTC for every
// reader; nothing on this page is formatted from the browser's clock.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Container, Typography, Stack, Button, TextField, MenuItem, Autocomplete,
  CircularProgress, Alert, Link, InputAdornment, TablePagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import {
  ArrowBack, Refresh, People, LocationCity, LocationOff, Schedule, Search, PublicOutlined
} from '@mui/icons-material'
import { analyticsService } from '../../services/analytics.service'
import { HourBars } from './charts'
import { SERIES, nf } from './chartTheme'
import { StatCard, Section, Empty, RangeFilter } from './analyticsUi'
import {
  PRESET_VALUES, TIMEZONE_LABEL, rangeLabelOf, isValidCustomRange,
  CITY_PAGE_SIZE, cityShare, formatShare, citySummary,
  ALL_HOURS, ALL_CITIES, HOUR_OPTIONS, hourLabel, hourWindowLabel, hasHour,
  busiestHour, hourScopeLabel, hourSelectionSummary
} from './analyticsRange'

// The filters live in the URL, so a view of this page can be reloaded, kept in
// a bookmark or handed to a colleague and still be the same view. They are
// replaced rather than pushed: Back belongs to the dashboard this page was
// opened from, not to each filter the reader tried on the way.
const readFilters = (params) => {
  const range = params.get('range')
  const from = params.get('from')
  const to = params.get('to')
  const hour = params.get('hour')

  const window = range === 'custom' && isValidCustomRange({ from, to })
    ? { range: 'custom', from, to }
    : { range: PRESET_VALUES.includes(range) ? range : '7d' }

  return {
    window,
    // An hour survives only as one of 0–23. '0' is midnight and must survive.
    hour: hour !== null && /^([0-9]|1[0-9]|2[0-3])$/.test(hour) ? hour : ALL_HOURS,
    city: params.get('city') || ALL_CITIES
  }
}

const writeFilters = ({ window, hour, city }) => {
  const params = { range: window.range }
  if (window.range === 'custom') {
    params.from = window.from
    params.to = window.to
  }
  if (hasHour(hour)) params.hour = String(hour)
  if (city) params.city = city
  return params
}

const CityTrafficPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = useMemo(() => readFilters(searchParams), [])

  const [window, setWindow] = useState(initial.window)
  const [hour, setHour] = useState(initial.hour)
  const [city, setCity] = useState(initial.city)

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(CITY_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')

  const [result, setResult] = useState({ key: null, data: null, error: '' })
  const [reloads, setReloads] = useState(0)

  // Typing is debounced, so a search is one request rather than one per key.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // A narrower question always starts at its first page: page four of the old
  // answer is rarely a page of the new one.
  useEffect(() => { setPage(0) }, [term, hour, city, window])

  useEffect(() => {
    setSearchParams(writeFilters({ window, hour, city }), { replace: true })
  }, [window, hour, city, setSearchParams])

  const requestKey = `${JSON.stringify(window)}|${hour}|${city}|${page}|${rowsPerPage}|${term}|${reloads}`
  const loading = result.key !== requestKey
  const data = result.data

  useEffect(() => {
    let cancelled = false
    analyticsService.getCityHourly(window, {
      page: page + 1, limit: rowsPerPage, search: term, hour, city
    })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res?.data || null, error: '' })
      })
      .catch((err) => {
        if (!cancelled) {
          setResult((r) => ({
            ...r, key: requestKey, error: err?.response?.data?.message || 'Could not load city traffic.'
          }))
        }
      })
    return () => { cancelled = true }
  }, [window, hour, city, page, rowsPerPage, term, requestKey])

  const rows = data?.rows || []
  const totalVisitors = data?.visitors || 0
  const hourly = data?.hourly || []
  const peak = useMemo(() => busiestHour(hourly), [hourly])
  const rangeLabel = rangeLabelOf(data)

  const onHour = useCallback((next) => setHour(next), [])

  // The city filter's choices are every city in the window, whatever hour is
  // selected — narrowing the hour must not narrow what can be asked about.
  const cityOptions = data?.cityOptions || []

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ── Header ── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Button
            size="small"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/analytics')}
            sx={{ ml: -1, mb: 0.5 }}
          >
            Back to Analytics
          </Button>
          <Typography variant="h5" fontWeight={700}>Traffic by City</Typography>
          <Typography variant="body2" color="text.secondary">
            Detailed visitor traffic by city and time
          </Typography>
        </Box>

        <RangeFilter
          range={window}
          onChange={setWindow}
          rangeLabel={rangeLabel}
          fallbackDays={{ from: data?.from, to: data?.to }}
        >
          <Button
            size="small" variant="outlined" startIcon={<Refresh />}
            onClick={() => setReloads((n) => n + 1)} disabled={loading}
          >
            Refresh
          </Button>
        </RangeFilter>
      </Stack>

      {/* ── Hour and city filters ── */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 3 }}
      >
        <TextField
          select size="small" label="Hour" value={hour}
          onChange={(e) => setHour(e.target.value)}
          sx={{ minWidth: 180 }}
          slotProps={{ htmlInput: { 'aria-label': 'Hour of the UTC day' } }}
        >
          {HOUR_OPTIONS.map((o) => (
            <MenuItem key={o.value === ALL_HOURS ? 'all' : o.value} value={o.value}>
              {o.label}
              {o.value !== ALL_HOURS && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {hourWindowLabel(o.value)}
                </Typography>
              )}
            </MenuItem>
          ))}
        </TextField>

        <Autocomplete
          size="small"
          options={cityOptions}
          value={city || null}
          onChange={(_e, next) => setCity(next || ALL_CITIES)}
          sx={{ minWidth: 240 }}
          renderInput={(params) => (
            <TextField {...params} label="City" placeholder="All Cities" />
          )}
          noOptionsText="No cities in this period"
        />

        {(hasHour(hour) || city) && (
          <Button
            size="small"
            onClick={() => { setHour(ALL_HOURS); setCity(ALL_CITIES) }}
          >
            Clear filters
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" color="text.secondary">
          {hourScopeLabel({ hour, city })}
        </Typography>
      </Stack>

      {result.error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={() => setReloads((n) => n + 1)}>Retry</Button>}
        >
          {result.error}
        </Alert>
      )}

      {loading && !data && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading city traffic…</Typography>
        </Stack>
      )}

      {data && (
        // A refetch keeps the current figures on screen, dimmed, rather than
        // blanking the page.
        <Box sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms', pointerEvents: loading ? 'none' : 'auto' }}>
          {/* ── Summary ── */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              mb: 3
            }}
          >
            <StatCard
              label="Total Visitors" value={nf.format(data.visitors)} icon={People} color={SERIES.orange}
              caption={`${nf.format(data.pageViews)} page views`}
              hint="A visitor is a browsing session, counted in the UTC hour it began. Page views are counted separately and are never mixed into this figure."
            />
            <StatCard
              label="Known City Visitors" value={nf.format(data.knownVisitors)} icon={PublicOutlined} color={SERIES.blue}
              caption={data.unknownVisitors
                ? `${nf.format(data.unknownVisitors)} with an unknown location`
                : 'Every visitor has a city'}
            />
            <StatCard
              label="Cities" value={nf.format(data.totalCities)} icon={LocationCity} color={SERIES.aqua}
              caption={hasHour(hour) || city
                ? `${nf.format(data.windowCities)} in the whole period`
                : 'With traffic in this period'}
            />
            <StatCard
              label={hasHour(hour) ? 'Selected Hour Traffic' : 'Busiest Hour'}
              value={hasHour(hour)
                ? nf.format(data.visitors)
                : (peak ? hourLabel(peak.hour) : '—')}
              icon={Schedule}
              color={SERIES.yellow}
              caption={hasHour(hour)
                ? `${hourLabel(hour)} · ${hourWindowLabel(hour)}`
                : (peak ? `${nf.format(peak.visitors)} visitors · ${hourWindowLabel(peak.hour)}` : 'No traffic in this period')}
              hint="Hours are hours of the UTC day. 3 PM is 15:00–15:59 UTC, and over a multi-day period it means that hour on each of those days."
            />
          </Box>

          {/* ── Hourly traffic ── */}
          <Section
            title="Hourly Traffic"
            subtitle={`Visitors by hour of the UTC day · ${TIMEZONE_LABEL}`}
            action={hasHour(hour) && (
              <Button size="small" onClick={() => setHour(ALL_HOURS)}>All Hours</Button>
            )}
            sx={{ mb: 2 }}
          >
            {data.visitors || hourly.some((h) => h.visitors) ? (
              <>
                <HourBars
                  items={hourly}
                  selected={hour}
                  onSelect={onHour}
                  color={SERIES.blue}
                  formatHour={hourLabel}
                  formatWindow={hourWindowLabel}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  {hasHour(hour) && (
                    <Typography component="span" variant="caption" fontWeight={700} color="text.primary">
                      {hourLabel(hour)} · {hourWindowLabel(hour)} —{' '}
                    </Typography>
                  )}
                  {hourSelectionSummary({ hour, visitors: data.visitors, cities: data.totalCities })}
                  {city && ` · ${city} only`}
                </Typography>
              </>
            ) : (
              <Empty icon={Schedule}>No traffic in this period.</Empty>
            )}
          </Section>

          {/* ── Traffic by city ── */}
          <Section
            title="Traffic by City"
            subtitle={hourScopeLabel({ hour, city })}
          >
            {/* Search sits above the table rather than in the card's header:
                at phone width a full-width field beside the title would push
                the page wider than the screen. */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ mb: 1.5 }}
            >
              <TextField
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cities…"
                sx={{ width: { xs: '100%', sm: 260 } }}
                slotProps={{
                  htmlInput: { 'aria-label': 'Search cities' },
                  input: {
                    startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {citySummary({ total: data.total, totalCities: data.totalCities, search: term })}
                {` · ${nf.format(data.unknownVisitors)} visitors have an unknown location`}
              </Typography>
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }}>#</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell align="right">Visitors</TableCell>
                    <TableCell align="right">Share</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((c, i) => (
                    <TableRow key={c.city} hover>
                      <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                      <TableCell>{c.city}</TableCell>
                      <TableCell>
                        {c.country || <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">{nf.format(c.visitors)}</TableCell>
                      <TableCell align="right">{formatShare(cityShare(c.visitors, totalVisitors))}</TableCell>
                    </TableRow>
                  ))}

                  {!loading && !rows.length && !result.error && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Empty icon={LocationOff}>
                          {term
                            ? `No city matches “${term}” in this selection.`
                            : 'No city data in this selection.'}
                        </Empty>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Unknown locations are real visitors, so they are shown — as
                      their own row, never folded into a city. */}
                  {!loading && !term && data.unknownVisitors > 0 && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">Unknown location</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">{nf.format(data.unknownVisitors)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {formatShare(cityShare(data.unknownVisitors, totalVisitors))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* The pagination toolbar has a minimum width of its own; letting
                it scroll inside the card keeps the page itself from widening. */}
            <Box sx={{ overflowX: 'auto' }}>
              <TablePagination
                component="div"
                count={data.total}
                page={page}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[25, 50, 100]}
                onPageChange={(e, p) => setPage(p)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              />
            </Box>

            {/* DB-IP's licence (CC BY 4.0) requires this credit and link
                wherever its data is shown. */}
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              City data from{' '}
              <Link href="https://db-ip.com" target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                IP Geolocation by DB-IP
              </Link>
              . Approximate, and never derived from a stored address.
            </Typography>
          </Section>
        </Box>
      )}
    </Container>
  )
}

export default CityTrafficPage
