import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Container,
  Typography,
  Button,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Stack
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add,
  Edit,
  Delete,
  Search,
  CheckCircle,
  Cancel
} from '@mui/icons-material'
import { aboutService } from '../../services/about.service'
import LeadershipFormDialog from './LeadershipFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusChip from '../../components/StatusChip'
import Toast from '../../components/Toast'

const LeadershipPage = () => {
  const [members, setMembers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity })

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aboutService.getAllLeadershipMembers()
      setMembers(res.data.members)
    } catch {
      showToast('Failed to load leadership team', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.designation.toLowerCase().includes(q)
      )
    )
  }, [search, members])

  const handleAdd = () => {
    setSelectedMember(null)
    setFormOpen(true)
  }

  const handleEdit = (member) => {
    setSelectedMember(member)
    setFormOpen(true)
  }

  const handleSave = async (formData, targetTeam) => {
    setSaving(true)
    try {
      if (selectedMember) {
        // Save the edited fields first, so a move carries the latest values;
        // the transfer then moves the record off this page.
        await aboutService.updateLeadershipMember(selectedMember._id, formData)
        if (targetTeam) {
          await aboutService.transferLeadershipMember(selectedMember._id, targetTeam)
          showToast('Leadership member moved to Board of Directors successfully')
        } else {
          showToast('Leadership member updated successfully')
        }
      } else {
        await aboutService.createLeadershipMember(formData)
        showToast('Leadership member created successfully')
      }
      setFormOpen(false)
      fetchMembers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = (id, name) => {
    setDeleteDialog({ open: true, id, name })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await aboutService.deleteLeadershipMember(deleteDialog.id)
      showToast('Leadership member deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchMembers()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await aboutService.toggleLeadershipStatus(id)
      fetchMembers()
      showToast('Status updated successfully')
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const columns = [
    {
      field: 'photo',
      headerName: 'Photo',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Avatar src={row.photo?.url} alt={row.name} sx={{ width: 40, height: 40 }}>
          {row.name?.[0]}
        </Avatar>
      )
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'designation',
      headerName: 'Designation',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'displayOrder',
      headerName: 'Order',
      width: 80,
      type: 'number'
    },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => <StatusChip isActive={row.isActive} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <IconButton
              size="small"
              color={row.isActive ? 'success' : 'default'}
              onClick={() => handleToggleStatus(row._id)}
            >
              {row.isActive ? (
                <CheckCircle fontSize="small" />
              ) : (
                <Cancel fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => handleEdit(row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteConfirm(row._id, row.name)}
            >
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
        <Typography variant="h5" fontWeight={700}>
          Leadership Team
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>
          Add Member
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or designation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ width: 340 }}
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
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.100' }
          }}
        />
      </Box>

      <LeadershipFormDialog
        open={formOpen}
        member={selectedMember}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Leadership Member"
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

export default LeadershipPage
