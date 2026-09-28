// The saved monthly plan: what is scheduled, and what became of it.
//
// Everything here comes from the server on each read. The plan outlives this
// tab — close it, refresh, come back tomorrow, and the rows are still there
// with whatever the scheduler has since done to them — so this panel never
// keeps its own copy of the truth, it only shows the last answer and asks
// again after anything that could have changed it.

import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Stack, Typography, Button, Chip, Alert, Tooltip,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Link
} from '@mui/material'
import { Replay, PlayArrow, DeleteSweep, Schedule, Refresh, OpenInNew } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'
import { geminiService } from '../../services/gemini.service'
import { usePagePermission } from '../../hooks/usePermissions'
import { errorMessage } from './geminiBlogUtils'
import {
  PLAN_ROW_STATUS, canRetry, draftOf, planCounts, planSummaryLine, whenLine
} from './scheduledPlanModel'

const Count = ({ label, value, color }) => (
  <Stack spacing={0.25} sx={{ minWidth: 92 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" fontWeight={700} color={color}>{value}</Typography>
  </Stack>
)

const ScheduledPlanPanel = ({ showToast, refreshToken }) => {
  // A view-only role sees what is scheduled and none of the controls. The
  // server refuses them regardless; this only keeps the page honest.
  const { canEdit: canGenerate } = usePagePermission('geminiBlogs')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await geminiService.getPlan()
      setData(res.data)
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'The saved plan could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Read on mount, and again whenever something outside this panel has saved a
  // plan. Reading is all that happens here: opening the page never generates
  // anything — that is the scheduler's job, on its own timer, on the server.
  useEffect(() => { load() }, [load, refreshToken])

  const rows = data?.rows || []
  const counts = planCounts(data?.summary)
  const today = data?.today

  const act = async (key, fn, successMessage) => {
    setBusy(key)
    try {
      const res = await fn()
      setData(res.data)
      if (successMessage) showToast(res.message || successMessage, 'success')
    } catch (err) {
      showToast(errorMessage(err, 'That did not work.'), 'error')
    } finally {
      setBusy('')
    }
  }

  const runNow = () => act('run', geminiService.runPlanNow, 'Scheduled generation run')
  const clear = () => act('clear', geminiService.clearPlan, 'Schedule cleared')
  const retry = (id) => act(`retry:${id}`, () => geminiService.retryPlanRow(id), 'Row queued for another attempt')

  if (loading && !data) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading the saved plan…</Typography>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ mb: rows.length ? 2 : 0 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Schedule fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                {data?.plan ? data.plan.name : 'Scheduled plan'}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {planSummaryLine(data?.summary)}
              {data?.timezone && ` · dates read in ${data.timezone}`}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" startIcon={<Refresh />} onClick={load} disabled={!!busy || loading}>
              Refresh
            </Button>
            {canGenerate && !!rows.length && (
              <Tooltip title="Generates everything due today now, instead of waiting for the scheduler's next pass">
                <span>
                  <Button
                    size="small" variant="outlined" startIcon={<PlayArrow />}
                    onClick={runNow} disabled={!!busy}
                  >
                    {busy === 'run' ? 'Running…' : 'Run due rows now'}
                  </Button>
                </span>
              </Tooltip>
            )}
            {canGenerate && !!rows.length && (
              <Button
                size="small" color="error" startIcon={<DeleteSweep />}
                onClick={clear} disabled={!!busy}
              >
                Clear schedule
              </Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}

        {!rows.length && !error && (
          <Typography variant="body2" color="text.secondary">
            No plan is scheduled. Upload a month's plan below and it will be saved here — each row
            is generated as a draft on its own date, and nothing is ever published automatically.
          </Typography>
        )}

        {!!rows.length && (
          <>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              <Count label="Scheduled" value={counts.scheduled} />
              <Count label="Generated" value={counts.generated} color={counts.generated ? 'success.main' : undefined} />
              <Count label="Needs attention" value={counts.failed} color={counts.failed ? 'error.main' : undefined} />
              {!!counts.invalid && <Count label="Invalid" value={counts.invalid} color="error.main" />}
            </Stack>

            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }}>#</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Date</TableCell>
                    <TableCell>Topic</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell sx={{ width: 70 }}>Image</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const status = PLAN_ROW_STATUS[r.status] || { label: r.status, color: 'default' }
                    const draft = draftOf(r)
                    return (
                      <TableRow key={r._id} hover sx={{ verticalAlign: 'top' }}>
                        <TableCell sx={{ color: 'text.secondary' }}>{r.rowNumber || i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.scheduledDay}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{r.topic}</Typography>
                          {!!r.errors?.length && (
                            <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                              {r.errors.map((e) => e.message).join(' · ')}
                            </Typography>
                          )}
                          {r.lastError && r.status === 'failed' && (
                            <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                              {r.lastError}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={r.categoryName ? 'text.primary' : 'text.secondary'}>
                            {r.categoryName || 'Gemini chooses'}
                          </Typography>
                        </TableCell>
                        <TableCell>{r.generateImage ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Stack spacing={0.5} alignItems="flex-start">
                            <Chip size="small" label={status.label} color={status.color} variant={status.variant} />
                            <Typography variant="caption" color="text.secondary">
                              {whenLine(r, today)}
                              {r.attempts > 1 ? ` · ${r.attempts} attempts` : ''}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          {draft && (
                            <Link
                              component={RouterLink}
                              to={`/blogs/${draft._id}/edit`}
                              underline="hover"
                              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
                            >
                              Open draft <OpenInNew sx={{ fontSize: 13 }} />
                            </Link>
                          )}
                          {canGenerate && canRetry(r) && (
                            <Button
                              size="small" startIcon={<Replay />}
                              onClick={() => retry(r._id)} disabled={!!busy}
                            >
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
              Each row is generated on its date and saved as a draft for review. Nothing is
              published automatically, and a row that has produced a draft is never generated again.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default ScheduledPlanPanel
