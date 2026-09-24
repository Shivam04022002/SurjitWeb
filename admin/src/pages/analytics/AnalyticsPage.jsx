import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Container, Typography, Card, CardContent, Stack, Button, TextField, Popover,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, Link, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TablePagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import {
  Refresh, People, Visibility, AssignmentTurnedIn, ContactPhone, Timer, ExitToApp,
  InfoOutlined, OpenInNew, TouchApp, LocationOff, CalendarMonth
} from '@mui/icons-material'
import { analyticsService } from '../../services/analytics.service'
import { LineChart, DonutChart, BarList } from './charts'
import { SERIES, nf } from './chartTheme'

const SITE_URL = 'https://surjitfinance.com'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' }
]

// Colour follows the source, whatever else is on screen.
const SOURCE_COLORS = {
  direct: SERIES.blue,
  search: SERIES.orange,
  social: SERIES.aqua,
  referral: SERIES.yellow
}

const TRAFFIC_SERIES = [
  { key: 'pageViews', label: 'Page Views', color: SERIES.blue },
  { key: 'visits', label: 'Visitors', color: SERIES.orange }
]

const LOAN_SERIES = [
  { key: 'loanApplicationClicks', label: 'Loan Application Clicks', color: SERIES.blue }
]

// Days arrive as YYYY-MM-DD in the business timezone; parse them as local
// calendar dates so the label never shifts by a day.
const parseDay = (day) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatAxisDate = (day, long = false) => parseDay(day).toLocaleDateString('en-GB', long
  ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  : { day: 'numeric', month: 'short' })

const formatRangeDay = (day) => parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDuration = (sec) => {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}h ${m}m` : `${m}m ${s}s`
}

const formatPercent = (ratio) => (ratio == null ? '—' : `${(ratio * 100).toFixed(1)}%`)

const formatActivityTime = (iso) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

// ── Building blocks ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color, caption, hint }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: `${color}14` }}>
          <Icon fontSize="small" sx={{ color }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
        {hint && (
          <Tooltip title={hint} arrow>
            <InfoOutlined sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="h4" fontWeight={700} lineHeight={1.15}>{value}</Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {caption}
        </Typography>
      )}
    </CardContent>
  </Card>
)

// minWidth 0 lets a grid cell shrink below its content (a wide table then
// scrolls inside the card instead of widening the page).
const Section = ({ title, subtitle, action, children, sx }) => (
  <Card sx={{ height: '100%', minWidth: 0, ...sx }}>
    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {action}
      </Stack>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </CardContent>
  </Card>
)

const Empty = ({ children = 'No data available', icon: Icon }) => (
  <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 5, color: 'text.secondary', height: '100%' }}>
    {Icon && <Icon sx={{ color: 'text.disabled' }} />}
    <Typography variant="body2" color="text.secondary" align="center">{children}</Typography>
  </Stack>
)

const PageLink = ({ path }) => (
  <Link
    href={`${SITE_URL}${path}`}
    target="_blank"
    rel="noopener noreferrer"
    underline="hover"
    color="inherit"
    sx={{ wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
  >
    {path}
    <OpenInNew sx={{ fontSize: 13, color: 'text.disabled' }} />
  </Link>
)

// ── Custom range picker ──────────────────────────────────────────────────────

const CustomRangePopover = ({ anchorEl, onClose, initial, onApply }) => {
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const max = localToday()
  const invalid = !from || !to || from > to || to > max

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Stack spacing={2} sx={{ p: 2, width: 280 }}>
        <Typography variant="subtitle2">Custom range</Typography>
        <TextField
          label="From" type="date" size="small" value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || max } }}
        />
        <TextField
          label="To" type="date" size="small" value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from, max } }}
        />
        <Typography variant="caption" color="text.secondary">Up to 366 days.</Typography>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onClose}>Cancel</Button>
          <Button size="small" variant="contained" disabled={invalid} onClick={() => onApply({ from, to })}>
            Apply
          </Button>
        </Stack>
      </Stack>
    </Popover>
  )
}

// ── Top pages "View All" ─────────────────────────────────────────────────────

// Mounted only while open, so each opening starts on page one for the range
// currently selected.
const AllPagesDialog = ({ onClose, range, rangeLabel }) => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [result, setResult] = useState({ key: null, rows: [], total: 0, error: '' })

  // Loading is derived: the rows on screen belong to some other request.
  const requestKey = `${page}|${rowsPerPage}`
  const loading = result.key !== requestKey
  const error = result.error

  useEffect(() => {
    let cancelled = false
    analyticsService.getPages(range, { page: page + 1, limit: rowsPerPage })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, rows: res?.data?.rows || [], total: res?.data?.total || 0, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setResult((r) => ({ ...r, key: requestKey, error: err?.response?.data?.message || 'Could not load pages.' }))
      })
    return () => { cancelled = true }
  }, [range, page, rowsPerPage, requestKey])

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        All Pages
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{rangeLabel}</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        <TableContainer sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>#</TableCell>
                <TableCell>Page</TableCell>
                <TableCell align="right">Page Views</TableCell>
                <TableCell align="right">Unique Visitors</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.rows.map((p, i) => (
                <TableRow key={p.path} hover>
                  <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                  <TableCell><PageLink path={p.path} /></TableCell>
                  <TableCell align="right">{nf.format(p.pageViews)}</TableCell>
                  <TableCell align="right">{nf.format(p.visitors)}</TableCell>
                </TableRow>
              ))}
              {!loading && !result.rows.length && !error && (
                <TableRow><TableCell colSpan={4}><Empty /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <TablePagination
        component="div"
        count={result.total}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(e, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
      />
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const [range, setRange] = useState({ range: '7d' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customAnchor, setCustomAnchor] = useState(null)
  const [allPagesOpen, setAllPagesOpen] = useState(false)
  // Ignores a slow response for a range the admin has already moved away from.
  const requestId = useRef(0)

  const fetchOverview = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const res = await analyticsService.getOverview(range)
      if (id === requestId.current) setData(res?.data || null)
    } catch (err) {
      if (id === requestId.current) {
        setError(err?.response?.data?.message || 'Could not load analytics. Please try again.')
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const rangeLabel = data
    ? (data.from === data.to ? formatRangeDay(data.from) : `${formatRangeDay(data.from)} – ${formatRangeDay(data.to)}`)
    : ''

  const onPreset = (e, value) => {
    // Custom opens its picker from its own onClick, which also fires when it
    // is already selected (the group reports null for that).
    if (!value || value === 'custom') return
    setRange({ range: value })
  }

  const k = data?.kpis
  const contactCaption = k?.contactBreakdown
    ?.filter((a) => a.clicks > 0)
    .map((a) => `${a.label.replace(/ Click$/, '')} ${nf.format(a.clicks)}`)
    .join(' · ')
  const loanTotal = data ? data.daily.reduce((n, d) => n + d.loanApplicationClicks, 0) : 0
  const sourceTotal = data ? data.sources.reduce((n, s) => n + s.visitors, 0) : 0
  const actionsTotal = data ? data.actions.reduce((n, a) => n + a.clicks, 0) : 0

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ── Header ── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>Website Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Track website traffic, page performance and user engagement
          </Typography>
        </Box>
        <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1} sx={{ maxWidth: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ maxWidth: '100%' }}>
            <ToggleButtonGroup
              size="small" exclusive value={range.range} onChange={onPreset}
              sx={{ maxWidth: '100%', overflowX: 'auto' }}
            >
              {PRESETS.map((r) => (
                <ToggleButton key={r.value} value={r.value} sx={{ px: 1.5 }}>{r.label}</ToggleButton>
              ))}
              <ToggleButton value="custom" onClick={(e) => setCustomAnchor(e.currentTarget)} sx={{ px: 1.5 }}>
                <CalendarMonth sx={{ fontSize: 16, mr: 0.5 }} />Custom
              </ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={fetchOverview} disabled={loading}>
              Refresh
            </Button>
          </Stack>
          {rangeLabel && (
            <Typography variant="caption" color="text.secondary">
              {rangeLabel}
              {data?.timezone && ` · ${data.timezone}`}
            </Typography>
          )}
        </Stack>
      </Stack>

      {customAnchor && (
        <CustomRangePopover
          anchorEl={customAnchor}
          onClose={() => setCustomAnchor(null)}
          initial={{ from: data?.from || localToday(), to: data?.to || localToday() }}
          onApply={({ from, to }) => {
            setCustomAnchor(null)
            setRange({ range: 'custom', from, to })
          }}
        />
      )}

      {loading && !data && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading analytics…</Typography>
        </Stack>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={fetchOverview}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {data && (
        // A refetch keeps the current figures on screen, dimmed, rather than
        // blanking the page.
        <Box sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms', pointerEvents: loading ? 'none' : 'auto' }}>
          {/* ── KPI cards ── */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
              mb: 3
            }}
          >
            <StatCard
              label="Total Visitors" value={nf.format(k.visitors)} icon={People} color={SERIES.orange}
              caption="Unique browsing sessions"
              hint="A visitor is a browsing session that ends after 30 minutes of inactivity. The site stores no personal identifier, so someone returning on another day counts again."
            />
            <StatCard
              label="Total Page Views" value={nf.format(k.pageViews)} icon={Visibility} color={SERIES.blue}
              caption={k.visitors ? `${(k.pageViews / k.visitors).toFixed(1)} pages per visitor` : 'No data available'}
            />
            <StatCard
              label="Loan Application Clicks" value={nf.format(k.loanApplicationClicks)} icon={AssignmentTurnedIn} color="#1a237e"
              caption="Clicks on Apply / Loan Application buttons"
              hint="Counts clicks on any Loan Application call-to-action on the website. It does not count submitted, approved or disbursed applications."
            />
            <StatCard
              label="Contact Clicks" value={nf.format(k.contactClicks)} icon={ContactPhone} color={SERIES.aqua}
              caption={contactCaption || 'Phone, email, Contact Us and map clicks'}
            />
            <StatCard
              label="Avg Session Duration" value={formatDuration(k.avgSessionDurationSec)} icon={Timer} color={SERIES.yellow}
              caption={k.avgSessionDurationSec == null ? 'No data available' : 'First to last activity in a session'}
              hint="Time from a session's first page view to its last page view or tracked click. Single-page sessions with no clicks count as 0s."
            />
            <StatCard
              label="Bounce Rate" value={formatPercent(k.bounceRate)} icon={ExitToApp} color="#e34948"
              caption={k.bounceRate == null ? 'No data available' : 'Left after one page, no clicks'}
            />
          </Box>

          {/* ── Traffic + source ── */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, mb: 2 }}>
            <Section title="Traffic Overview" subtitle="Daily page views and visitors">
              <LineChart
                data={data.daily}
                series={TRAFFIC_SERIES}
                formatDate={formatAxisDate}
                ariaLabel={`Daily page views and visitors, ${rangeLabel}. Total ${k.pageViews} page views and ${k.visitors} visitors.`}
              />
            </Section>
            <Section title="User Source" subtitle="How visitors reached the website">
              {sourceTotal ? (
                <Stack spacing={2.5}>
                  <DonutChart
                    totalLabel="Visitors"
                    items={data.sources.map((s) => ({ key: s.key, label: s.label, value: s.visitors, color: SOURCE_COLORS[s.key] }))}
                  />
                  {data.referrers.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        Top referring sites
                      </Typography>
                      <Stack spacing={0.5}>
                        {data.referrers.map((r) => (
                          <Stack key={r.host} direction="row" spacing={1}>
                            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={r.host}>{r.host}</Typography>
                            <Typography variant="body2" fontWeight={600}>{nf.format(r.visitors)}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              ) : <Empty />}
            </Section>
          </Box>

          {/* ── Pages + actions ── */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, mb: 2 }}>
            <Section
              title="Top Pages"
              subtitle="Most viewed pages in this period"
              action={data.topPages.total > data.topPages.rows.length && (
                <Button size="small" onClick={() => setAllPagesOpen(true)}>
                  View All ({nf.format(data.topPages.total)})
                </Button>
              )}
            >
              {data.topPages.rows.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 40 }}>#</TableCell>
                        <TableCell>Page</TableCell>
                        <TableCell align="right">Page Views</TableCell>
                        <TableCell align="right">Unique Visitors</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topPages.rows.map((p, i) => (
                        <TableRow key={p.path} hover>
                          <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                          <TableCell><PageLink path={p.path} /></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{nf.format(p.pageViews)}</TableCell>
                          <TableCell align="right">{nf.format(p.visitors)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : <Empty />}
            </Section>

            <Section
              title="Key User Actions"
              subtitle={actionsTotal ? `${nf.format(actionsTotal)} tracked clicks` : 'Clicks on buttons and links'}
            >
              <BarList
                items={data.actions.map((a) => ({ key: a.action, label: a.label, value: a.clicks }))}
                emptyText="No tracked clicks in this period"
              />
            </Section>
          </Box>

          {/* ── Trends ── */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 2 }}>
            <Section
              title="Loan Application Click Trend"
              subtitle={`${nf.format(loanTotal)} clicks on Loan Application buttons`}
            >
              <LineChart
                data={data.daily}
                series={LOAN_SERIES}
                formatDate={formatAxisDate}
                height={220}
                area
                ariaLabel={`Daily Loan Application clicks, ${rangeLabel}. Total ${loanTotal}.`}
              />
            </Section>
            <Section title="Visitor Trend by Source" subtitle="New visitors per day, by where they came from">
              <LineChart
                data={data.sourceTrend}
                series={data.sources.map((s) => ({ key: s.key, label: s.label, color: SOURCE_COLORS[s.key] }))}
                formatDate={formatAxisDate}
                height={220}
                ariaLabel={`Daily visitors by source, ${rangeLabel}.`}
              />
            </Section>
          </Box>

          {/* ── Device, location, activity ── */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
            <Section title="Device Type" subtitle="Visitors by device">
              <BarList
                items={data.devices.map((d) => ({ key: d.key, label: d.label, value: d.visitors }))}
              />
            </Section>

            <Section
              title="Traffic by City"
              subtitle={data.location.available
                ? `${nf.format(data.location.knownVisitors)} of ${nf.format(data.location.visitors)} visitors have a known city`
                : 'Visitors by city'}
            >
              {data.location.available ? (
                <>
                  <BarList
                    items={data.location.cities.map((c) => ({ key: c.city, label: c.city, value: c.visitors }))}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    {nf.format(data.location.unknownVisitors)} visitors have an unknown location
                    {data.location.totalCities > data.location.cities.length
                      && ` · showing the top ${data.location.cities.length} of ${nf.format(data.location.totalCities)} cities`}
                  </Typography>
                  {/* DB-IP's licence (CC BY 4.0) requires this credit and link
                      wherever its data is shown. */}
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    City data from{' '}
                    <Link href="https://db-ip.com" target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                      IP Geolocation by DB-IP
                    </Link>
                    . Approximate, and never derived from a stored address.
                  </Typography>
                </>
              ) : (
                <Empty icon={LocationOff}>
                  No city data available yet.
                  <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    {data.location.enabled
                      ? 'Location is recorded for new visits only; earlier visits have none.'
                      : 'Location data will appear for new visits once location tracking is set up on the server.'}
                  </Typography>
                </Empty>
              )}
            </Section>

            <Section title="Recent Activity" subtitle="Latest anonymous page views and clicks">
              {data.recentActivity.length ? (
                <Stack spacing={0} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {data.recentActivity.map((a, i) => (
                    <Stack
                      key={`${a.at}-${i}`}
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      sx={{ py: 1, borderBottom: i < data.recentActivity.length - 1 ? 1 : 0, borderColor: 'divider' }}
                    >
                      {a.type === 'action'
                        ? <TouchApp sx={{ fontSize: 18, mt: 0.25, color: SERIES.blue }} />
                        : <Visibility sx={{ fontSize: 18, mt: 0.25, color: 'text.disabled' }} />}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={a.type === 'action' ? 600 : 400} noWrap>
                          {a.type === 'action' ? a.label : `Viewed ${a.path}`}
                        </Typography>
                        {a.type === 'action' && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            on {a.path}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {formatActivityTime(a.at)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : <Empty />}
            </Section>
          </Box>
        </Box>
      )}

      {allPagesOpen && (
        <AllPagesDialog
          onClose={() => setAllPagesOpen(false)}
          range={range}
          rangeLabel={rangeLabel}
        />
      )}
    </Container>
  )
}

export default AnalyticsPage
