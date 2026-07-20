import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, TextField, Button, Grid, Paper, Stack,
  MenuItem, Divider, CircularProgress, Breadcrumbs, Link, Chip, FormHelperText
} from '@mui/material'
import { ArrowBack, Save, Public, Unpublished, OpenInNew } from '@mui/icons-material'
import { blogService } from '../../services/blog.service'
import RichTextEditor from '../../components/RichTextEditor'
import ImageUpload from '../../components/ImageUpload'
import Toast from '../../components/Toast'

const SITE_URL = 'https://surjitfinance.com'

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 300)

const EMPTY = {
  title: '', slug: '', summary: '', content: '', author: 'Surjit Finance',
  category: '', tags: '', readingTime: '', status: 'draft', publishedAt: '',
  seo: { metaTitle: '', metaDescription: '', metaKeywords: '' }
}

const BlogEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [form, setForm] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [featuredFile, setFeaturedFile] = useState(null)
  const [featuredUrl, setFeaturedUrl] = useState('')
  const [ogFile, setOgFile] = useState(null)
  const [ogUrl, setOgUrl] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  // Set once the slug has been typed by hand, so it stops tracking the title.
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }, [])

  useEffect(() => {
    blogService.getAllCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => showToast('Failed to load categories', 'error'))
  }, [showToast])

  useEffect(() => {
    if (isNew) return
    blogService.getBlogById(id)
      .then((res) => {
        const b = res.data.blog
        setForm({
          title: b.title || '',
          slug: b.slug || '',
          summary: b.summary || '',
          content: b.content || '',
          author: b.author || '',
          category: b.category?._id || '',
          tags: (b.tags || []).join(', '),
          readingTime: b.readingTime || '',
          status: b.status || 'draft',
          publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString().slice(0, 10) : '',
          seo: {
            metaTitle: b.seo?.metaTitle || '',
            metaDescription: b.seo?.metaDescription || '',
            metaKeywords: b.seo?.metaKeywords || ''
          }
        })
        setFeaturedUrl(b.featuredImage?.url || '')
        setOgUrl(b.seo?.ogImage?.url || '')
      })
      .catch(() => showToast('Failed to load blog', 'error'))
      .finally(() => setLoading(false))
  }, [id, isNew, showToast])

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => ({ ...e, [name]: '' }))
  }

  const setSeo = (name, value) => setForm((f) => ({ ...f, seo: { ...f.seo, [name]: value } }))

  const handleTitle = (value) => {
    setField('title', value)
    if (!slugTouched) setField('slug', slugify(value))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.slug.trim()) e.slug = 'Slug is required'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Lowercase letters, numbers and hyphens only'
    if (!form.summary.trim()) e.summary = 'Short description is required'
    // The editor emits an empty paragraph rather than an empty string.
    if (!form.content.replace(/<[^>]*>/g, '').trim()) e.content = 'Content is required'
    if (isNew && !featuredFile) e.featuredImage = 'Featured image is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildFormData = (statusOverride) => {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('slug', form.slug)
    fd.append('summary', form.summary)
    fd.append('content', form.content)
    fd.append('author', form.author)
    fd.append('status', statusOverride || form.status)
    fd.append('category', form.category || '')
    fd.append('tags', form.tags)
    if (form.readingTime !== '') fd.append('readingTime', form.readingTime)
    if (form.publishedAt) fd.append('publishedAt', new Date(form.publishedAt).toISOString())
    fd.append('seo.metaTitle', form.seo.metaTitle)
    fd.append('seo.metaDescription', form.seo.metaDescription)
    fd.append('seo.metaKeywords', form.seo.metaKeywords)
    if (featuredFile) fd.append('featuredImage', featuredFile)
    if (ogFile) fd.append('seo.ogImage', ogFile)
    return fd
  }

  const save = async (statusOverride) => {
    if (!validate()) {
      showToast('Please fix the highlighted fields', 'error')
      return
    }
    setSaving(true)
    try {
      const fd = buildFormData(statusOverride)
      if (isNew) {
        const res = await blogService.createBlog(fd)
        showToast(statusOverride === 'published' ? 'Blog published' : 'Draft saved')
        navigate(`/blogs/${res.data.blog._id}/edit`, { replace: true })
      } else {
        await blogService.updateBlog(id, fd)
        if (statusOverride) setField('status', statusOverride)
        showToast(statusOverride === 'published' ? 'Blog published'
          : statusOverride === 'draft' ? 'Blog moved to draft' : 'Blog updated')
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save blog', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" underline="hover" color="inherit" onClick={() => navigate('/blogs')}>Blogs</Link>
        <Typography color="text.primary">{isNew ? 'Add Blog' : 'Edit Blog'}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/blogs')}>Back</Button>
          <Typography variant="h5" fontWeight={700}>{isNew ? 'Add Blog' : 'Edit Blog'}</Typography>
          {!isNew && (
            <Chip
              label={form.status === 'published' ? 'Published' : 'Draft'}
              color={form.status === 'published' ? 'success' : 'default'}
              size="small"
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          {!isNew && form.status === 'published' && (
            <Button
              startIcon={<OpenInNew />}
              onClick={() => window.open(`${SITE_URL}/blogs/${form.slug}`, '_blank', 'noopener')}
            >
              Preview
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={saving ? <CircularProgress size={16} /> : <Save />}
            disabled={saving}
            onClick={() => save('draft')}
          >
            Save Draft
          </Button>
          {form.status === 'published' && !isNew ? (
            <Button variant="outlined" color="warning" startIcon={<Unpublished />} disabled={saving}
              onClick={() => save('draft')}>
              Unpublish
            </Button>
          ) : null}
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Public />}
            disabled={saving}
            onClick={() => save('published')}
          >
            Publish
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Main content */}
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Blog Title" required fullWidth value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                error={!!errors.title} helperText={errors.title}
                inputProps={{ maxLength: 250 }}
              />
              <TextField
                label="Slug" required fullWidth value={form.slug}
                onChange={(e) => { setSlugTouched(true); setField('slug', e.target.value) }}
                error={!!errors.slug}
                helperText={errors.slug || `Public URL: ${SITE_URL}/blogs/${form.slug || 'your-slug'}`}
                inputProps={{ maxLength: 300 }}
              />
              <TextField
                label="Short Description" required fullWidth multiline rows={3}
                value={form.summary} onChange={(e) => setField('summary', e.target.value)}
                error={!!errors.summary}
                helperText={errors.summary || `${form.summary.length}/1000 — shown on the blog listing card`}
                inputProps={{ maxLength: 1000 }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Full Content *</Typography>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setField('content', html)}
              showToast={showToast}
            />
            {errors.content && <FormHelperText error sx={{ mt: 1 }}>{errors.content}</FormHelperText>}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>SEO</Typography>
            <Stack spacing={2.5}>
              <TextField
                label="SEO Title" fullWidth value={form.seo.metaTitle}
                onChange={(e) => setSeo('metaTitle', e.target.value)}
                helperText="Falls back to the blog title when left empty"
                inputProps={{ maxLength: 250 }}
              />
              <TextField
                label="SEO Description" fullWidth multiline rows={2} value={form.seo.metaDescription}
                onChange={(e) => setSeo('metaDescription', e.target.value)}
                helperText="Falls back to the short description when left empty"
                inputProps={{ maxLength: 500 }}
              />
              <TextField
                label="SEO Keywords" fullWidth value={form.seo.metaKeywords}
                onChange={(e) => setSeo('metaKeywords', e.target.value)}
                helperText="Comma separated"
                inputProps={{ maxLength: 500 }}
              />
              <Divider />
              <ImageUpload
                label="Open Graph Image (optional)"
                name="ogImage"
                currentImageUrl={ogUrl}
                onChange={(file) => setOgFile(file)}
              />
            </Stack>
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Featured Image *</Typography>
            <ImageUpload
              label="Featured Image"
              name="featuredImage"
              required
              currentImageUrl={featuredUrl}
              error={errors.featuredImage}
              onChange={(file) => { setFeaturedFile(file); setErrors((e) => ({ ...e, featuredImage: '' })) }}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Details</Typography>
            <Stack spacing={2.5}>
              <TextField
                select label="Category" fullWidth value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                helperText="Drives Related Blogs on the article page"
              >
                <MenuItem value="">Uncategorised</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c._id} value={c._id} disabled={!c.isActive}>
                    {c.name}{!c.isActive ? ' (disabled)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Author" fullWidth value={form.author}
                onChange={(e) => setField('author', e.target.value)}
                inputProps={{ maxLength: 120 }}
              />
              <TextField
                label="Tags" fullWidth value={form.tags}
                onChange={(e) => setField('tags', e.target.value)}
                helperText="Comma separated — searchable"
              />
              <TextField
                label="Reading Time (minutes)" fullWidth type="number" value={form.readingTime}
                onChange={(e) => setField('readingTime', e.target.value)}
                helperText="Left empty, it is calculated from the content"
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Publish Date" fullWidth type="date" value={form.publishedAt}
                onChange={(e) => setField('publishedAt', e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Defaults to the moment it is first published"
              />
              <TextField
                select label="Status" fullWidth value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
              </TextField>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default BlogEditorPage
