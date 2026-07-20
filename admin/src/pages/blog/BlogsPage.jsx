import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Chip, IconButton, Tooltip,
  TextField, InputAdornment, Stack, Avatar, MenuItem
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import {
  Add, Edit, Delete, Search, Article, Public, Unpublished,
  ContentCopy, OpenInNew
} from '@mui/icons-material'
import { blogService } from '../../services/blog.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const SITE_URL = 'https://surjitfinance.com'

const StatusPill = ({ status }) => (
  <Chip
    label={status === 'published' ? 'Published' : 'Draft'}
    color={status === 'published' ? 'success' : 'default'}
    size="small"
    variant={status === 'published' ? 'filled' : 'outlined'}
  />
)

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const BlogsPage = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [sortModel, setSortModel] = useState([{ field: 'createdAt', sort: 'desc' }])

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: '' })
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  // Paging, sorting and filtering are all server-side, so the list stays fast
  // once the blog count grows past a page.
  const fetchBlogs = useCallback(async () => {
    setLoading(true)
    try {
      const sort = sortModel[0] || { field: 'createdAt', sort: 'desc' }
      const res = await blogService.getAllBlogs({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search || undefined,
        status: status || undefined,
        category: category || undefined,
        sortBy: sort.field,
        sortOrder: sort.sort
      })
      setRows(res.data.data)
      setTotal(res.data.total)
    } catch {
      showToast('Failed to load blogs', 'error')
    } finally {
      setLoading(false)
    }
  }, [paginationModel, sortModel, search, status, category])

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchBlogs, 300)
    return () => clearTimeout(t)
  }, [fetchBlogs])

  useEffect(() => {
    blogService.getAllCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => { /* filter simply stays empty */ })
  }, [])

  const handlePublishToggle = async (row) => {
    try {
      if (row.status === 'published') {
        await blogService.unpublishBlog(row._id)
        showToast('Blog moved to draft')
      } else {
        await blogService.publishBlog(row._id)
        showToast('Blog published')
      }
      fetchBlogs()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error')
    }
  }

  const handleDuplicate = async (row) => {
    try {
      const res = await blogService.duplicateBlog(row._id)
      showToast('Blog duplicated as a draft')
      navigate(`/blogs/${res.data.blog._id}/edit`)
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to duplicate', 'error')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await blogService.deleteBlog(deleteDialog.id)
      showToast('Blog deleted')
      setDeleteDialog({ open: false, id: null, title: '' })
      fetchBlogs()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete blog', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      field: 'featuredImage', headerName: 'Image', width: 90, sortable: false, filterable: false,
      renderCell: (params) => (
        <Avatar
          variant="rounded"
          src={params.row.featuredImage?.url || undefined}
          sx={{ width: 56, height: 40, bgcolor: 'grey.200' }}
        >
          <Article fontSize="small" />
        </Avatar>
      )
    },
    {
      field: 'title', headerName: 'Title', flex: 1, minWidth: 220,
      renderCell: (params) => (
        <Stack spacing={0} sx={{ py: 0.5 }}>
          <Typography variant="body2" fontWeight={600} noWrap title={params.row.title}>
            {params.row.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>/{params.row.slug}</Typography>
        </Stack>
      )
    },
    {
      field: 'category', headerName: 'Category', width: 150, sortable: false,
      renderCell: (params) => (
        params.row.category
          ? <Chip label={params.row.category.name} size="small" variant="outlined" />
          : <Typography variant="caption" color="text.disabled">Uncategorised</Typography>
      )
    },
    { field: 'author', headerName: 'Author', width: 130 },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (params) => <StatusPill status={params.row.status} />
    },
    {
      field: 'publishedAt', headerName: 'Published', width: 130,
      renderCell: (params) => <Typography variant="body2">{fmt(params.row.publishedAt)}</Typography>
    },
    {
      field: 'updatedAt', headerName: 'Last Updated', width: 130,
      renderCell: (params) => <Typography variant="body2">{fmt(params.row.updatedAt)}</Typography>
    },
    {
      field: 'actions', headerName: 'Actions', width: 220, sortable: false, filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => navigate(`/blogs/${params.row._id}/edit`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.status === 'published' ? 'Unpublish' : 'Publish'}>
            <IconButton
              size="small"
              color={params.row.status === 'published' ? 'success' : 'default'}
              onClick={() => handlePublishToggle(params.row)}
            >
              {params.row.status === 'published' ? <Public fontSize="small" /> : <Unpublished fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.status === 'published' ? 'Preview on site' : 'Publish to preview'}>
            <span>
              <IconButton
                size="small"
                disabled={params.row.status !== 'published'}
                onClick={() => window.open(`${SITE_URL}/blogs/${params.row.slug}`, '_blank', 'noopener')}
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Duplicate">
            <IconButton size="small" onClick={() => handleDuplicate(params.row)}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small" color="error"
              onClick={() => setDeleteDialog({ open: true, id: params.row._id, title: params.row.title })}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Blogs</Typography>
          <Typography variant="body2" color="text.secondary">
            Create, publish and manage the articles shown on the website
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/blogs/new')}>
          Add Blog
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search title, author or tag…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <TextField
          size="small" select label="Status" value={status}
          onChange={(e) => { setStatus(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
        </TextField>
        <TextField
          size="small" select label="Category" value={category}
          onChange={(e) => { setCategory(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })) }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All</MenuItem>
          {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
        </TextField>
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r._id}
        loading={loading}
        rowHeight={64}
        rowCount={total}
        paginationMode="server"
        sortingMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        autoHeight
        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete blog"
        message={`Delete "${deleteDialog.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, title: '' })}
      />

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default BlogsPage
