import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Chip,
  IconButton, Tooltip, TextField, InputAdornment, Stack, Avatar
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, CheckCircle, Cancel, OpenInNew, PhotoLibrary
} from '@mui/icons-material'
import { galleryService } from '../../services/gallery.service'
import AlbumFormDialog from './AlbumFormDialog'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusChip from '../../components/StatusChip'
import Toast from '../../components/Toast'

const AlbumsPage = () => {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const fetchAlbums = useCallback(async () => {
    setLoading(true)
    try {
      const res = await galleryService.getAllAlbums()
      setAlbums(res.data.albums)
    } catch {
      showToast('Failed to load albums', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlbums() }, [fetchAlbums])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? albums.filter((a) => a.title.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)) : albums)
  }, [search, albums])

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (selectedAlbum) {
        await galleryService.updateAlbum(selectedAlbum._id, formData)
        showToast('Album updated successfully')
      } else {
        await galleryService.createAlbum(formData)
        showToast('Album created successfully')
      }
      setFormOpen(false)
      fetchAlbums()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Operation failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await galleryService.deleteAlbum(deleteDialog.id)
      showToast('Album deleted successfully')
      setDeleteDialog({ open: false, id: null, name: '' })
      fetchAlbums()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    try {
      await galleryService.toggleAlbumStatus(id)
      fetchAlbums()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const columns = [
    {
      field: 'cover',
      headerName: 'Cover',
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <Avatar
          src={row.coverImage?.url || ''}
          variant="rounded"
          sx={{ width: 44, height: 44, bgcolor: 'grey.100' }}
        >
          <PhotoLibrary fontSize="small" color="disabled" />
        </Avatar>
      )
    },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 160 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 160 },
    {
      field: 'imagesCount',
      headerName: 'Images',
      width: 90,
      type: 'number',
      renderCell: ({ row }) => (
        <Chip label={row.imagesCount ?? 0} size="small" variant="outlined" />
      )
    },
    { field: 'displayOrder', headerName: 'Order', width: 80, type: 'number' },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => <StatusChip isActive={row.isActive} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <IconButton size="small" color={row.isActive ? 'success' : 'default'} onClick={() => handleToggleStatus(row._id)}>
              {row.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Album">
            <IconButton size="small" color="primary" onClick={() => { setSelectedAlbum(row); setFormOpen(true) }}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open Editor">
            <IconButton size="small" color="secondary" onClick={() => navigate(`/gallery/albums/${row._id}/edit`)}>
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: row._id, name: row.title })}>
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
        <Typography variant="h5" fontWeight={700}>Gallery Albums</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setSelectedAlbum(null); setFormOpen(true) }}>
          New Album
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by title or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
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
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.100' } }}
        />
      </Box>

      <AlbumFormDialog
        open={formOpen}
        album={selectedAlbum}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
        saving={saving}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Album"
        message={`Are you sure you want to delete "${deleteDialog.name}"? All images inside will also be permanently deleted.`}
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

export default AlbumsPage
