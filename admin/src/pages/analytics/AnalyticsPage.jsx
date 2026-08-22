import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Card, CardContent, Stack, Button,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress
} from '@mui/material'
import { Refresh, TrendingUp, Visibility } from '@mui/icons-material'
import { analyticsService } from '../../services/analytics.service'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' }
]

const nf = new Intl.NumberFormat('en-IN')

const shortDate = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// A small inline SVG chart rather than a charting dependency. The admin bundle
// is already large, and this needs two series over at most 30 points.
const TrafficChart = ({ daily }) => {
  const theme = useTheme()
  const width = 720
  const height = 220
  const padL = 44
  const padR = 12
  const padT = 12
  const padB = 28

  const max = Math.max(1, ...daily.map((d) => Math.max(d.pageViews, d.visits)))
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const stepX = daily.length > 1 ? plotW / (daily.length - 1) : 0
  const x = (i) => padL + (daily.length > 1 ? i * stepX : plotW / 2)
  const y = (v) => padT + plotH - (v / max) * plotH

  const line = (key) => daily.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ')

  // At most five y-axis gridlines, on whole numbers.
  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i))

  const views = theme.palette.primary.main
  const visits = theme.palette.success.main

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block' }}
        role="img"
        aria-label="Daily visits and page views"
      >
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={padL} x2={width - padR} y1={y(v)} y2={y(v)}
              stroke={theme.palette.divider} strokeWidth="1"
            />
            <text
              x={padL - 8} y={y(v) + 4} textAnchor="end"
              fontSize="11" fill={theme.palette.text.secondary}
            >
              {v}
            </text>
          </g>
        ))}

        <path d={line('pageViews')} fill="none" stroke={views} strokeWidth="2" />
        <path d={line('visits')} fill="none" stroke={visits} strokeWidth="2" />

        {daily.map((d, i) => (
          <g key={d.date}>
            <circle cx={x(i)} cy={y(d.pageViews)} r="2.5" fill={views} />
            <circle cx={x(i)} cy={y(d.visits)} r="2.5" fill={visits} />
            <title>{`${d.date} — ${d.visits} visits, ${d.pageViews} page views`}</title>
          </g>
        ))}

        {/* Label the ends, and the middle when there is room. */}
        {daily.map((d, i) => {
          const show = i === 0 || i === daily.length - 1 ||
            (daily.length > 6 && i === Math.floor(daily.length / 2))
          if (!show) return null
          return (
            <text
              key={d.date} x={x(i)} y={height - 8}
              textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}
              fontSize="11" fill={theme.palette.text.secondary}
            >
              {shortDate(d.date)}
            </text>
          )
        })}
      </svg>

      <Stack direction="row" spacing={3} sx={{ mt: 1, pl: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 12, height: 3, bgcolor: views, borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Page Views</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 12, height: 3, bgcolor: visits, borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary">Visits</Typography>
        </Stack>
      </Stack>
    </Box>
  )
}

const StatCard = ({ label, value, icon: Icon, color }) => (
  <Card sx={{ flex: 1, minWidth: 200 }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Icon fontSize="small" sx={{ color }} />
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h4" fontWeight={700}>{nf.format(value)}</Typography>
    </CardContent>
  </Card>
)

const AnalyticsPage = () => {
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await analyticsService.getOverview(range)
      setData(res?.data || null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load analytics. Please try again.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const hasTraffic = !!data && (data.totalPageViews > 0 || data.totalVisits > 0)
  const topMax = data?.topPages?.length ? data.topPages[0].pageViews : 0

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>Website Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Anonymous traffic from the public website
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(e, v) => { if (v) setRange(v) }}
          >
            {RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value}>{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button size="small" startIcon={<Refresh />} onClick={fetchOverview} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {loading && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading analytics…
          </Typography>
        </Stack>
      )}

      {!loading && error && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={fetchOverview}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {!loading && !error && data && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <StatCard label="Total Visits" value={data.totalVisits} icon={TrendingUp} color="success.main" />
            <StatCard label="Total Page Views" value={data.totalPageViews} icon={Visibility} color="primary.main" />
          </Stack>

          {!hasTraffic && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body1" align="center" color="text.secondary" sx={{ py: 4 }}>
                  No website traffic data yet.
                </Typography>
              </CardContent>
            </Card>
          )}

          {hasTraffic && (
            <>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                    Daily Traffic
                  </Typography>
                  <TrafficChart daily={data.daily || []} />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                    Top Pages
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Page</TableCell>
                          <TableCell align="right">Visits</TableCell>
                          <TableCell align="right">Views</TableCell>
                          <TableCell sx={{ width: '30%' }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.topPages.map((p) => (
                          <TableRow key={p.path}>
                            <TableCell sx={{ wordBreak: 'break-all' }}>{p.path}</TableCell>
                            <TableCell align="right">{nf.format(p.visits)}</TableCell>
                            <TableCell align="right">{nf.format(p.pageViews)}</TableCell>
                            <TableCell>
                              <LinearProgress
                                variant="determinate"
                                value={topMax ? (p.pageViews / topMax) * 100 : 0}
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </Container>
  )
}

export default AnalyticsPage
