import { useState, useEffect, useCallback } from 'react'
import {
  Box, Container, Typography, Chip, IconButton, Tooltip,
  TextField, InputAdornment, Stack, MenuItem,
  Select, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Grid, Divider
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Search, Delete, Download, Visibility, FileDownload
} from '@mui/icons-material'
import { careerService } from '../../services/career.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' }
]

const STATUS_COLORS = {
  new: 'default',
  reviewed: 'info',
  shortlisted: 'warning',
  interview_scheduled: 'secondary',
  selected: 'success',
  rejected: 'error'
}

const STATUS_LABELS = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  selected: 'Selected',
  rejected: 'Rejected'
}

const ApplicationsPage = () => {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewDialog, setViewDialog] = useState({ open: false, app: null })
  const [statusDialog, setStatusDialog] = useState({ open: false, id: null, current: '' })
  const [newStatus, setNewStatus] = useState('')
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const res = await careerService.getAllApplications(params)
      setApplications(res.data.applications)
    } catch {
      showToast('Failed to load applications', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => { fetchApplications() }, 400)
    return () => clearTimeout(timer)
  }, [fetchApplications])

  const handleStatusUpdate = async () => {
    if (!newStatus) return
    setUpdatingStatus(true)
    try {
      await careerService.updateApplicationStatus(statusDialog.id, newStatus)
      showToast('Status updated successfully')
      setStatusDialog({ open: false, id: null, current: '' })
      setNewStatus('')
      fetchApplications()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await careerService.deleteApplication(deleteDialog.id)
      showToast('Application deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchApplications()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    const url = careerService.getExportUrl()
    const params = new URLSearchParams()
    if (statusFilter) params.append('status', statusFilter)
    window.open(`${url}?${params.toString()}`, '_blank')
  }

  const columns = [
    { field: 'applicantName', headerName: 'Applicant', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 190 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'appliedPositionTitle',
      headerName: 'Position',
      flex: 1,
      minWidth: 150,
      renderCell: ({ row }) => row.appliedPositionTitle || row.appliedPosition?.jobTitle || '—'
    },
    {
      field: 'createdAt',
      headerName: 'Applied',
      width: 110,
      renderCell: ({ row }) => new Date(row.createdAt).toLocaleDateString('en-IN')
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 160,
      renderCell: ({ row }) => (
        <Chip
          label={STATUS_LABELS[row.status] || row.status}
          color={STATUS_COLORS[row.status] || 'default'}
          size="small"
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View Details">
            <IconButton size="small" color="primary" onClick={() => setViewDialog({ open: true, app: row })}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Change Status">
            <IconButton size="small" color="secondary" onClick={() => { setStatusDialog({ open: true, id: row._id, current: row.status }); setNewStatus(row.status) }}>
              <Chip label="Status" size="small" variant="outlined" sx={{ cursor: 'pointer', fontSize: '0.7rem' }} />
            </IconButton>
          </Tooltip>
          {row.resumeUrl && (
            <Tooltip title="Download Resume">
              <IconButton size="small" color="success" onClick={() => window.open(row.resumeUrl, '_blank')}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: row._id, name: row.applicantName })}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={700}>Job Applications</Typography>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={handleExport}>
          Export CSV
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name, email, position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
          }}
          sx={{ width: 320 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select value={statusFilter} label="Filter by Status" onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={applications}
          columns={columns}
          getRowId={(row) => row._id}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.100' } }}
        />
      </Box>

      {/* View Details Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, app: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Application Details</DialogTitle>
        <DialogContent dividers>
          {viewDialog.app && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Applicant Name</Typography>
                <Typography variant="body2" fontWeight={500}>{viewDialog.app.applicantName}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box mt={0.5}>
                  <Chip label={STATUS_LABELS[viewDialog.app.status] || viewDialog.app.status} color={STATUS_COLORS[viewDialog.app.status] || 'default'} size="small" />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2">{viewDialog.app.email}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Phone</Typography>
                <Typography variant="body2">{viewDialog.app.phone}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Applied Position</Typography>
                <Typography variant="body2">{viewDialog.app.appliedPositionTitle || viewDialog.app.appliedPosition?.jobTitle || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Applied On</Typography>
                <Typography variant="body2">{new Date(viewDialog.app.createdAt).toLocaleString('en-IN')}</Typography>
              </Grid>
              {viewDialog.app.resumeUrl && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Resume</Typography>
                  <Box>
                    <Button size="small" startIcon={<Download />} onClick={() => window.open(viewDialog.app.resumeUrl, '_blank')}>
                      Download
                    </Button>
                  </Box>
                </Grid>
              )}
              {viewDialog.app.coverLetter && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">Cover Letter</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{viewDialog.app.coverLetter}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setViewDialog({ open: false, app: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusDialog.open} onClose={() => setStatusDialog({ open: false, id: null, current: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>Change Application Status</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatusDialog({ open: false, id: null, current: '' })} disabled={updatingStatus}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusUpdate} disabled={updatingStatus || !newStatus}>
            {updatingStatus ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Application"
        message={`Are you sure you want to delete the application from "${deleteDialog.name}"?`}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, name: '' })}
        loading={deleting}
      />

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default ApplicationsPage
