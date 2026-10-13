import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Stack, Chip, TextField, MenuItem, Button, Alert, Tooltip, Paper
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { Refresh, Replay } from '@mui/icons-material'
import { usePagePermission } from '../../hooks/usePermissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'
import { emailSettingsService } from '../../services/emailSettings.service'
import { requestErrorMessage } from './emailSettings'
import {
  STATUS_META, STATUS_ORDER, statusMeta, outcomeLabel, filtersToParams, attemptsLabel, canRetry
} from './emailNotifications'

// Same permission as Email Settings: reading the log is a view of API Settings,
// bringing a retry forward is an edit. The server enforces both.
const PAGE_KEY = 'integrations'

const fmt = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

const EMPTY_COUNTS = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]))

const EmailNotificationsPage = () => {
  const { canEdit } = usePagePermission(PAGE_KEY)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [confirmRow, setConfirmRow] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const { params, error: filterError } = filtersToParams({ status, from, to, ...paginationModel })
  const query = params ? JSON.stringify(params) : ''

  // State changes only once the request settles; an invalid filter asks
  // nothing and shows its own message instead.
  const fetchPage = useCallback(() => {
    if (!query) return undefined
    let cancelled = false
    emailSettingsService.getNotifications(JSON.parse(query))
      .then((res) => {
        if (cancelled) return
        setRows(res.data.notifications)
        setTotal(res.data.pagination.total)
        setCounts({ ...EMPTY_COUNTS, ...res.data.counts })
        setLoadError('')
      })
      .catch((err) => { if (!cancelled) setLoadError(requestErrorMessage(err, 'Could not load the delivery log.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  useEffect(() => fetchPage(), [fetchPage, reloadKey])

  const changeFilter = (setter) => (e) => {
    setter(e.target.value)
    setLoading(true)
    setPaginationModel((m) => ({ ...m, page: 0 }))
  }

  const reload = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const runRetry = async () => {
    const row = confirmRow
    if (!row || retrying) return
    setRetrying(true)
    try {
      const res = await emailSettingsService.retryNotification(row.id)
      const updated = res.data.notification
      setToast({
        open: true,
        severity: updated.status === 'sent' ? 'success' : 'warning',
        message: `${updated.applicationNumber}: ${statusMeta(updated.status).label}${updated.outcomeCode && updated.status !== 'sent' ? ` — ${outcomeLabel(updated.outcomeCode)}` : ''}`
      })
    } catch (err) {
      setToast({ open: true, severity: 'error', message: requestErrorMessage(err, 'The retry could not be run.') })
    } finally {
      setRetrying(false)
      setConfirmRow(null)
      reload()
    }
  }

  const columns = [
    {
      field: 'applicationNumber', headerName: 'Application #', width: 150, sortable: false,
      renderCell: (p) => <Typography variant="body2" fontWeight={600}>{p.row.applicationNumber}</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 190, sortable: false,
      renderCell: (p) => {
        const meta = statusMeta(p.row.status)
        return (
          <Tooltip title={meta.description}>
            <Chip size="small" color={meta.color} label={meta.label} />
          </Tooltip>
        )
      }
    },
    {
      field: 'outcomeCode', headerName: 'Outcome', flex: 1, minWidth: 260, sortable: false,
      renderCell: (p) => (
        <Stack spacing={0} sx={{ overflow: 'hidden', py: 0.5 }}>
          <Typography variant="body2" noWrap>{outcomeLabel(p.row.outcomeCode) || '—'}</Typography>
          {p.row.outcomeCode && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{p.row.outcomeCode}</Typography>
          )}
        </Stack>
      )
    },
    { field: 'attempts', headerName: 'Attempts', width: 100, sortable: false, valueGetter: (v, row) => attemptsLabel(row) },
    { field: 'recipientCount', headerName: 'Recipients', width: 100, sortable: false, valueGetter: (v, row) => (row.status === 'sent' ? row.recipientCount : '—') },
    { field: 'createdAt', headerName: 'Created', width: 175, sortable: false, valueGetter: (v) => fmt(v) },
    { field: 'lastAttemptAt', headerName: 'Last attempt', width: 175, sortable: false, valueGetter: (v) => fmt(v) },
    {
      field: 'nextAttemptAt', headerName: 'Next attempt', width: 175, sortable: false,
      valueGetter: (v, row) => (row.status === 'retrying' || row.status === 'pending' ? fmt(v) : '—')
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false, filterable: false,
      renderCell: (p) => (canRetry(p.row, { canEdit })
        ? (
          <Button size="small" startIcon={<Replay />} onClick={() => setConfirmRow(p.row)} aria-label={`Retry now ${p.row.applicationNumber}`}>
            Retry now
          </Button>
        )
        : null)
    }
  ]

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700} component="h1">Email Delivery Log</Typography>
        <Typography variant="body2" color="text.secondary">
          What happened to each &quot;New Loan Application Received&quot; email
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Accepted by Microsoft</strong> means Microsoft 365 took the email for delivery, not that it reached every inbox.{' '}
        <strong>Delivery uncertain</strong> means the send did not complete and Microsoft may or may not have accepted it; such emails are never resent automatically, to avoid duplicates.
        {' '}Only a retry already scheduled after a temporary failure can be run early.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap aria-label="Counts by status">
          {STATUS_ORDER.map((s) => (
            <Chip
              key={s}
              size="small"
              variant={status === s ? 'filled' : 'outlined'}
              color={STATUS_META[s].color}
              label={`${STATUS_META[s].label}: ${counts[s]}`}
            />
          ))}
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems={{ sm: 'flex-start' }}>
        <TextField size="small" select label="Status" value={status} onChange={changeFilter(setStatus)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All statuses</MenuItem>
          {STATUS_ORDER.map((s) => <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>)}
        </TextField>
        <TextField
          size="small" type="date" label="From" value={from} onChange={changeFilter(setFrom)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }}
        />
        <TextField
          size="small" type="date" label="To" value={to} onChange={changeFilter(setTo)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }}
        />
        <Button variant="outlined" startIcon={<Refresh />} onClick={reload} disabled={!!filterError}>Refresh</Button>
      </Stack>

      {(filterError || loadError) && <Alert severity="error" sx={{ mb: 2 }}>{filterError || loadError}</Alert>}

      {/* The columns are wider than a phone. A zero-width box that fills the
          row keeps them from widening the whole page; the grid scrolls inside
          it instead. */}
      <Box sx={{ width: 0, minWidth: '100%', overflowX: 'auto' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading && !filterError}
          rowCount={total}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={(m) => { setLoading(true); setPaginationModel(m) }}
          pageSizeOptions={[10, 20, 50, 100]}
          disableRowSelectionOnClick
          disableColumnMenu
          autoHeight
          getRowHeight={() => 'auto'}
          localeText={{ noRowsLabel: 'No loan application emails match these filters.' }}
          sx={{ bgcolor: 'background.paper', minWidth: 900 }}
        />
      </Box>

      <ConfirmDialog
        open={!!confirmRow}
        title="Retry now"
        message={confirmRow ? `Send the email for ${confirmRow.applicationNumber} now instead of at its scheduled time? This uses attempt ${confirmRow.attempts + 1} of ${confirmRow.maxAttempts}.` : ''}
        confirmLabel="Retry now"
        confirmColor="primary"
        onConfirm={runRetry}
        onCancel={() => setConfirmRow(null)}
        loading={retrying}
      />
      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default EmailNotificationsPage
