import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, IconButton, Tooltip, Stack, Chip, Avatar,
  TextField, MenuItem, Rating, InputAdornment, Badge, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Divider
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Search, CheckCircle, Cancel, Delete, Visibility, ArrowUpward, ArrowDownward
} from '@mui/icons-material'
import { reviewService } from '../../services/review.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const initialsOf = (name) => String(name || '?').trim().charAt(0).toUpperCase()

const fmt = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

const STATUS_COLOR = { Pending: 'warning', Approved: 'success', Rejected: 'default' }

// Moderation queue. Reviews arrive from the website; admins approve, reject or
// delete them — they are never authored here.
const ReviewsPage = () => {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const [viewing, setViewing] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reviewService.getAllReviews({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined
      })
      setRows(res.data.data)
      setTotal(res.data.total)
      setPendingCount(res.data.pendingCount ?? 0)
    } catch {
      showToast('Failed to load reviews', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, search, status])

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchReviews, 300)
    return () => clearTimeout(t)
  }, [fetchReviews])

  const moderate = async (row, action) => {
    setBusy(true)
    try {
      if (action === 'approve') {
        await reviewService.approveReview(row._id)
        showToast(`Review from ${row.customerName} approved — now live on the website`)
      } else {
        await reviewService.rejectReview(row._id)
        showToast(`Review from ${row.customerName} rejected — hidden from the website`)
      }
      setViewing(null)
      fetchReviews()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update review', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await reviewService.deleteReview(deleteDialog.id)
      showToast('Review deleted')
      setDeleteDialog({ open: false, id: null, name: '' })
      setViewing(null)
      fetchReviews()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete review', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Ordering only affects approved reviews, which is all the website shows.
  const handleMove = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return

    const next = [...rows]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setRows(next)

    setBusy(true)
    try {
      await reviewService.reorderReviews(next.map((r) => r._id))
      showToast('Order updated')
      fetchReviews()
    } catch {
      showToast('Failed to reorder', 'error')
      fetchReviews()
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      field: 'customerName', headerName: 'Customer', flex: 1.1, minWidth: 200,
      renderCell: (p) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
          <Avatar src={p.row.photo?.url || undefined} sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
            {initialsOf(p.row.customerName)}
          </Avatar>
          <Stack spacing={0}>
            <Typography variant="body2" fontWeight={600} noWrap>{p.row.customerName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {p.row.mobile}{p.row.city ? ` · ${p.row.city}` : ''}
            </Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: 'rating', headerName: 'Rating', width: 140, sortable: false,
      renderCell: (p) => <Rating value={p.row.rating} readOnly size="small" />
    },
    {
      field: 'productName', headerName: 'Product', width: 160,
      renderCell: (p) => (p.row.productName
        ? <Chip label={p.row.productName} size="small" variant="outlined" />
        : <Typography variant="caption" color="text.disabled">—</Typography>)
    },
    {
      field: 'createdAt', headerName: 'Date', width: 120,
      renderCell: (p) => <Typography variant="body2">{fmt(p.row.createdAt)}</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip
          label={p.row.status}
          color={STATUS_COLOR[p.row.status] || 'default'}
          size="small"
          variant={p.row.status === 'Rejected' ? 'outlined' : 'filled'}
        />
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 230, sortable: false,
      renderCell: (p) => {
        const index = rows.findIndex((r) => r._id === p.row._id)
        return (
          <Stack direction="row">
            <Tooltip title="Read full review">
              <IconButton size="small" onClick={() => setViewing(p.row)}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={p.row.status === 'Approved' ? 'Already approved' : 'Approve — publish on the website'}>
              <span>
                <IconButton
                  size="small" color="success" disabled={busy || p.row.status === 'Approved'}
                  onClick={() => moderate(p.row, 'approve')}
                >
                  <CheckCircle fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={p.row.status === 'Rejected' ? 'Already rejected' : 'Reject — hide from the website'}>
              <span>
                <IconButton
                  size="small" color="warning" disabled={busy || p.row.status === 'Rejected'}
                  onClick={() => moderate(p.row, 'reject')}
                >
                  <Cancel fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move earlier">
              <span>
                <IconButton size="small" disabled={index === 0 || busy} onClick={() => handleMove(index, -1)}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move later">
              <span>
                <IconButton size="small" disabled={index === rows.length - 1 || busy} onClick={() => handleMove(index, 1)}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small" color="error"
                onClick={() => setDeleteDialog({ open: true, id: p.row._id, name: p.row.customerName })}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      }
    }
  ]

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Customer Reviews</Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted from the website — approve to publish, reject to hide
          </Typography>
        </Box>
        {pendingCount > 0 && (
          <Badge badgeContent={pendingCount} color="warning">
            <Chip label="Awaiting moderation" color="warning" variant="outlined" />
          </Badge>
        )}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search name, mobile, review, product or city…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 320 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => { setStatus(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Pending">Pending</MenuItem>
          <MenuItem value="Approved">Approved</MenuItem>
          <MenuItem value="Rejected">Rejected</MenuItem>
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        rowHeight={60}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        autoHeight
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      {/* Full review — the grid truncates, and a moderator needs the whole text. */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="sm" fullWidth>
        {viewing && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={viewing.photo?.url || undefined} sx={{ bgcolor: 'primary.main' }}>
                  {initialsOf(viewing.customerName)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{viewing.customerName}</Typography>
                  <Rating value={viewing.rating} readOnly size="small" />
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography variant="body1">{viewing.review}</Typography>
                <Divider />
                <Stack spacing={0.5}>
                  <Typography variant="body2"><strong>Mobile:</strong> {viewing.mobile}</Typography>
                  {viewing.email && <Typography variant="body2"><strong>Email:</strong> {viewing.email}</Typography>}
                  {viewing.city && <Typography variant="body2"><strong>City:</strong> {viewing.city}</Typography>}
                  {viewing.productName && <Typography variant="body2"><strong>Product:</strong> {viewing.productName}</Typography>}
                  <Typography variant="body2"><strong>Submitted:</strong> {fmt(viewing.createdAt)}</Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong>{' '}
                    <Chip label={viewing.status} color={STATUS_COLOR[viewing.status]} size="small" />
                  </Typography>
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setViewing(null)}>Close</Button>
              <Button
                color="warning" startIcon={<Cancel />} disabled={busy || viewing.status === 'Rejected'}
                onClick={() => moderate(viewing, 'reject')}
              >
                Reject
              </Button>
              <Button
                variant="contained" color="success" startIcon={<CheckCircle />}
                disabled={busy || viewing.status === 'Approved'}
                onClick={() => moderate(viewing, 'approve')}
              >
                Approve
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete review"
        message={`Permanently delete the review from "${deleteDialog.name}"? Rejecting hides it instead and keeps the record.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default ReviewsPage
