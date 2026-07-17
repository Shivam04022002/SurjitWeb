import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Chip,
  IconButton, Tooltip, TextField, InputAdornment, Stack
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, CheckCircle, Cancel,
  OpenInNew, Visibility, VisibilityOff, ContentCopy
} from '@mui/icons-material'
import { careerService } from '../../services/career.service'
import JobFormDialog from './JobFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusChip from '../../components/StatusChip'
import Toast from '../../components/Toast'

const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  internship: 'Internship',
  contract: 'Contract'
}

const JobOpeningsPage = () => {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await careerService.getAllJobs()
      setJobs(res.data.jobs)
    } catch {
      showToast('Failed to load job openings', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? jobs.filter((j) =>
      j.jobTitle.toLowerCase().includes(q) ||
      j.department.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q)
    ) : jobs)
  }, [search, jobs])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (selectedJob) {
        await careerService.updateJob(selectedJob._id, data)
        showToast('Job updated successfully')
      } else {
        await careerService.createJob(data)
        showToast('Job created successfully')
      }
      setFormOpen(false)
      fetchJobs()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await careerService.deleteJob(deleteDialog.id)
      showToast('Job deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchJobs()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await careerService.toggleJobStatus(id)
      fetchJobs()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const handleTogglePublish = async (id) => {
    try {
      await careerService.toggleJobPublish(id)
      fetchJobs()
    } catch {
      showToast('Failed to update publish status', 'error')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      await careerService.duplicateJob(id)
      showToast('Job duplicated successfully')
      fetchJobs()
    } catch {
      showToast('Failed to duplicate job', 'error')
    }
  }

  const columns = [
    { field: 'jobTitle', headerName: 'Title', flex: 1, minWidth: 160 },
    { field: 'department', headerName: 'Department', flex: 1, minWidth: 130 },
    { field: 'location', headerName: 'Location', width: 130 },
    {
      field: 'employmentType',
      headerName: 'Type',
      width: 110,
      renderCell: ({ row }) => (
        <Chip label={EMPLOYMENT_TYPE_LABELS[row.employmentType] || row.employmentType} size="small" variant="outlined" />
      )
    },
    { field: 'numberOfVacancies', headerName: 'Vacancies', width: 90, type: 'number' },
    {
      field: 'applicationDeadline',
      headerName: 'Deadline',
      width: 110,
      renderCell: ({ row }) => row.applicationDeadline
        ? new Date(row.applicationDeadline).toLocaleDateString('en-IN')
        : '—'
    },
    {
      field: 'isPublished',
      headerName: 'Published',
      width: 100,
      renderCell: ({ row }) => (
        <Chip
          label={row.isPublished ? 'Published' : 'Draft'}
          color={row.isPublished ? 'primary' : 'default'}
          size="small"
        />
      )
    },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 100,
      renderCell: ({ row }) => <StatusChip isActive={row.isActive} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <IconButton size="small" color={row.isActive ? 'success' : 'default'} onClick={() => handleToggleStatus(row._id)}>
              {row.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={row.isPublished ? 'Unpublish' : 'Publish'}>
            <IconButton size="small" color={row.isPublished ? 'primary' : 'default'} onClick={() => handleTogglePublish(row._id)}>
              {row.isPublished ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Basic Info">
            <IconButton size="small" color="primary" onClick={() => { setSelectedJob(row); setFormOpen(true) }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open Editor">
            <IconButton size="small" color="secondary" onClick={() => navigate(`/career/jobs/${row._id}/edit`)}>
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Duplicate">
            <IconButton size="small" onClick={() => handleDuplicate(row._id)}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: row._id, name: row.jobTitle })}>
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
        <Typography variant="h5" fontWeight={700}>Job Openings</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelectedJob(null); setFormOpen(true) }}>
          Add Job
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by title, department, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
          }}
          sx={{ width: 360 }}
        />
      </Box>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={filtered}
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

      <JobFormDialog
        open={formOpen}
        job={selectedJob}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Job Opening"
        message={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
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

export default JobOpeningsPage
