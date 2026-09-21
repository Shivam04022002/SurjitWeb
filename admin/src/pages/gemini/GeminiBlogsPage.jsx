import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, TextField, Button, Grid, Paper, Stack, MenuItem, Alert, AlertTitle,
  CircularProgress, LinearProgress, Chip, Divider, FormHelperText
} from '@mui/material'
import {
  AutoAwesome, Save, Refresh, Close, OpenInNew, ImageOutlined, CheckCircle
} from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import { blogService } from '../../services/blog.service'
import { usePermissions } from '../../hooks/usePermissions'
import RichTextEditor from '../../components/RichTextEditor'
import ImageUpload from '../../components/ImageUpload'
import ConfirmDialog from '../../components/ConfirmDialog'
import Toast from '../../components/Toast'

const SITE_URL = 'https://surjitfinance.com'
const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Today in India, the timezone the server stores the create date in.
const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 300)

const formatDay = (day) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// The generated image arrives as base64; the draft endpoint takes it as a
// normal file upload, exactly as if the admin had picked it.
const base64ToFile = (data, mimeType) => {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  return new File([bytes], `gemini-featured.${ext}`, { type: mimeType })
}

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback

const formFromGenerated = (blog) => ({
  title: blog.title || '',
  slug: blog.slug || '',
  summary: blog.summary || '',
  content: blog.content || '',
  author: blog.author || 'Surjit Finance',
  category: blog.category?._id || '',
  tags: (blog.tags || []).join(', '),
  seo: {
    metaTitle: blog.seo?.metaTitle || '',
    metaDescription: blog.seo?.metaDescription || '',
    metaKeywords: blog.seo?.metaKeywords || ''
  }
})

const GeminiBlogsPage = () => {
  const navigate = useNavigate()
  const { canCreate, isSuperAdmin } = usePermissions()

  const [availability, setAvailability] = useState(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [categories, setCategories] = useState([])

  const [topic, setTopic] = useState('')
  const [createDate, setCreateDate] = useState(todayIST())
  const [requestErrors, setRequestErrors] = useState({})

  // idle -> generating -> generated -> saving -> saved
  const [phase, setPhase] = useState('idle')
  const [genError, setGenError] = useState('')
  const [form, setForm] = useState(null)
  const [draftDate, setDraftDate] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [warnings, setWarnings] = useState([])
  const [imagePrompt, setImagePrompt] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const [featuredFile, setFeaturedFile] = useState(null)
  const [imageStatus, setImageStatus] = useState('idle') // idle | generating | ready | failed | off
  const [imageError, setImageError] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [imageKey, setImageKey] = useState(0)

  const [savedBlog, setSavedBlog] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'regenerate' | 'cancel'
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Guards against a second request starting before React re-renders the
  // disabled button (a fast double click). The server refuses duplicates too.
  const generatingRef = useRef(false)
  const imageRef = useRef(false)

  const showToast = useCallback((message, severity = 'success') => setToast({ open: true, message, severity }), [])

  useEffect(() => {
    if (!canCreate) return
    geminiService.getAvailability()
      .then((res) => setAvailability(res.data.availability))
      .catch((err) => setAvailabilityError(errorMessage(err, 'Could not check the Gemini configuration.')))
    blogService.getAllCategories()
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {})
  }, [canCreate])

  const generateImage = useCallback(async ({ title, summary, prompt }) => {
    if (imageRef.current) return
    imageRef.current = true
    setImageStatus('generating')
    setImageError('')
    try {
      const res = await geminiService.generateImage({ title, summary, imagePrompt: prompt })
      const { data, mimeType } = res.data.image
      setFeaturedFile(base64ToFile(data, mimeType))
      setImagePreview(`data:${mimeType};base64,${data}`)
      setImageKey((k) => k + 1)
      setImageStatus('ready')
    } catch (err) {
      setImageStatus('failed')
      setImageError(errorMessage(err, 'The featured image could not be generated.'))
    } finally {
      imageRef.current = false
    }
  }, [])

  const runGeneration = async () => {
    if (generatingRef.current) return
    const errs = {}
    if (topic.trim().length < 3) errs.topic = 'Enter a blog name or topic (at least 3 characters)'
    if (!createDate) errs.createDate = 'Choose a create date'
    setRequestErrors(errs)
    if (Object.keys(errs).length) return

    generatingRef.current = true
    setPhase('generating')
    setGenError('')
    setSavedBlog(null)
    try {
      const res = await geminiService.generateBlog({ topic: topic.trim(), createDate })
      const result = res.data
      setForm(formFromGenerated(result.blog))
      setDraftDate(result.createDate)
      setWarnings(result.warnings || [])
      setImagePrompt(result.imagePrompt || '')
      setSlugTouched(false)
      setFieldErrors({})
      setFeaturedFile(null)
      setImagePreview('')
      setImageKey((k) => k + 1)
      setPhase('generated')

      if (result.imageGenerationEnabled) {
        generateImage({ title: result.blog.title, summary: result.blog.summary, prompt: result.imagePrompt })
      } else {
        setImageStatus('off')
      }
    } catch (err) {
      const apiErrors = err?.response?.data?.errors || []
      if (apiErrors.length) setRequestErrors(Object.fromEntries(apiErrors.map((e) => [e.field, e.message])))
      setGenError(errorMessage(err, 'Blog generation failed. Please try again.'))
      // A failed regenerate keeps the earlier draft on screen.
      setPhase(form ? 'generated' : 'idle')
    } finally {
      generatingRef.current = false
    }
  }

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((e) => ({ ...e, [name]: '' }))
  }
  const setSeo = (name, value) => setForm((f) => ({ ...f, seo: { ...f.seo, [name]: value } }))
  const handleTitle = (value) => {
    setField('title', value)
    if (!slugTouched) setForm((f) => ({ ...f, slug: slugify(value) }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.slug.trim()) e.slug = 'Slug is required'
    else if (!SLUG_RX.test(form.slug)) e.slug = 'Lowercase letters, numbers and hyphens only'
    if (!form.summary.trim()) e.summary = 'Short description is required'
    if (!form.content.replace(/<[^>]*>/g, '').trim()) e.content = 'Content is required'
    if (!draftDate) e.createDate = 'Create date is required'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const saveDraft = async () => {
    if (phase === 'saving' || !validate()) {
      if (phase !== 'saving') showToast('Please fix the highlighted fields', 'error')
      return
    }
    setPhase('saving')
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('slug', form.slug)
      fd.append('summary', form.summary)
      fd.append('content', form.content)
      fd.append('author', form.author)
      fd.append('category', form.category || '')
      fd.append('tags', form.tags)
      fd.append('seo.metaTitle', form.seo.metaTitle)
      fd.append('seo.metaDescription', form.seo.metaDescription)
      fd.append('seo.metaKeywords', form.seo.metaKeywords)
      fd.append('createDate', draftDate)
      if (featuredFile) fd.append('featuredImage', featuredFile)

      const res = await geminiService.saveDraft(fd)
      setSavedBlog(res.data.blog)
      setPhase('saved')
      showToast('Draft saved')
    } catch (err) {
      const apiErrors = err?.response?.data?.errors || []
      if (apiErrors.length) setFieldErrors(Object.fromEntries(apiErrors.map((e) => [e.field, e.message])))
      showToast(errorMessage(err, 'Failed to save the draft'), 'error')
      setPhase('generated')
    }
  }

  const reset = () => {
    setForm(null)
    setPhase('idle')
    setGenError('')
    setWarnings([])
    setFeaturedFile(null)
    setImagePreview('')
    setImageStatus('idle')
    setSavedBlog(null)
    setTopic('')
    setCreateDate(todayIST())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!canCreate) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Gemini Blogs</Typography>
        <Alert severity="info">Only Super Admins and Editors can generate blogs.</Alert>
      </Container>
    )
  }

  const generating = phase === 'generating'
  const saving = phase === 'saving'
  const notConfigured = availability && !availability.configured
  const busy = generating || saving

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesome color="primary" />
          <Typography variant="h5" fontWeight={700}>Gemini Blogs</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Generate a complete blog draft with Google Gemini, review it, then save it as a draft.
          Nothing is published automatically.
        </Typography>
      </Box>

      {availabilityError && <Alert severity="error" sx={{ mb: 3 }}>{availabilityError}</Alert>}
      {notConfigured && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={isSuperAdmin && <Button color="inherit" size="small" onClick={() => navigate('/integrations/api')}>Open API</Button>}
        >
          Gemini is not configured yet. {isSuperAdmin ? 'Add the API key on the API page.' : 'Ask a Super Admin to add the API key on the API page.'}
        </Alert>
      )}

      {/* ── Request ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={6}>
            <TextField
              label="Blog Name / Topic" required fullWidth value={topic}
              onChange={(e) => { setTopic(e.target.value); setRequestErrors((x) => ({ ...x, topic: '' })) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy && !form) runGeneration() }}
              disabled={busy}
              error={!!requestErrors.topic}
              helperText={requestErrors.topic || 'e.g. "How an e-rickshaw loan helps drivers own their vehicle"'}
              inputProps={{ maxLength: 200 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Create Date" type="date" required fullWidth value={createDate}
              onChange={(e) => { setCreateDate(e.target.value); setRequestErrors((x) => ({ ...x, createDate: '' })) }}
              disabled={busy}
              error={!!requestErrors.createDate}
              helperText={requestErrors.createDate || 'Saved as the blog\'s create date (India time)'}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {!form && (
              <Button
                variant="contained" size="large" fullWidth sx={{ height: 56 }}
                startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
                onClick={runGeneration}
                disabled={busy || !availability?.configured}
              >
                {generating ? 'Generating…' : 'Generate Blog'}
              </Button>
            )}
          </Grid>
        </Grid>

        {generating && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Generating… Gemini is writing the blog. This usually takes 20–50 seconds.
            </Typography>
          </Box>
        )}
        {genError && !generating && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setGenError('')}>
            <AlertTitle>Generation failed</AlertTitle>
            {genError}
          </Alert>
        )}
      </Paper>

      {/* ── Saved ── */}
      {phase === 'saved' && savedBlog && (
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ mb: 3 }}
          action={(
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" startIcon={<OpenInNew />} onClick={() => navigate(`/blogs/${savedBlog._id}/edit`)}>
                Open Draft
              </Button>
              <Button color="inherit" size="small" onClick={reset}>Generate Another</Button>
            </Stack>
          )}
        >
          <AlertTitle>Draft saved</AlertTitle>
          "{savedBlog.title}" is saved as a draft dated {formatDay(draftDate)}. Review and publish it from All Blogs when ready.
        </Alert>
      )}

      {/* ── Preview / edit ── */}
      {form && phase !== 'saved' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h6" fontWeight={700}>Generated Blog</Typography>
              <Chip label="Draft" size="small" />
              {!generating && !genError && <Chip label="Generation successful" size="small" color="success" variant="outlined" />}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Close />} onClick={() => setConfirm('cancel')} disabled={busy || imageStatus === 'generating'}>Cancel</Button>
              <Button
                variant="outlined"
                startIcon={generating ? <CircularProgress size={16} /> : <Refresh />}
                onClick={() => setConfirm('regenerate')}
                disabled={busy || imageStatus === 'generating'}
              >
                {generating ? 'Generating…' : 'Regenerate'}
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                onClick={saveDraft}
                disabled={busy || imageStatus === 'generating'}
              >
                {saving ? 'Saving draft…' : 'Save as Draft'}
              </Button>
            </Stack>
          </Box>

          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {warnings.map((w) => <div key={w}>{w}</div>)}
            </Alert>
          )}

          <Box sx={{ opacity: generating ? 0.5 : 1, pointerEvents: generating ? 'none' : 'auto', transition: 'opacity 150ms' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                  <Stack spacing={2.5}>
                    <TextField
                      label="Blog Title" required fullWidth value={form.title}
                      onChange={(e) => handleTitle(e.target.value)}
                      error={!!fieldErrors.title} helperText={fieldErrors.title}
                      inputProps={{ maxLength: 250 }}
                    />
                    <TextField
                      label="Slug" required fullWidth value={form.slug}
                      onChange={(e) => { setSlugTouched(true); setField('slug', e.target.value) }}
                      error={!!fieldErrors.slug}
                      helperText={fieldErrors.slug || `Public URL once published: ${SITE_URL}/blogs/${form.slug || 'your-slug'}`}
                      inputProps={{ maxLength: 300 }}
                    />
                    <TextField
                      label="Short Description (Excerpt)" required fullWidth multiline rows={3}
                      value={form.summary} onChange={(e) => setField('summary', e.target.value)}
                      error={!!fieldErrors.summary}
                      helperText={fieldErrors.summary || `${form.summary.length}/1000 — shown on the blog listing card`}
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
                  {fieldErrors.content && <FormHelperText error sx={{ mt: 1 }}>{fieldErrors.content}</FormHelperText>}
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>SEO</Typography>
                  <Stack spacing={2.5}>
                    <TextField
                      label="SEO Title" fullWidth value={form.seo.metaTitle}
                      onChange={(e) => setSeo('metaTitle', e.target.value)}
                      helperText={`${form.seo.metaTitle.length} characters — about 60 displays fully in search results`}
                      inputProps={{ maxLength: 250 }}
                    />
                    <TextField
                      label="SEO Meta Description" fullWidth multiline rows={2} value={form.seo.metaDescription}
                      onChange={(e) => setSeo('metaDescription', e.target.value)}
                      helperText={`${form.seo.metaDescription.length} characters — about 155 displays fully`}
                      inputProps={{ maxLength: 500 }}
                    />
                    <TextField
                      label="SEO Keywords" fullWidth value={form.seo.metaKeywords}
                      onChange={(e) => setSeo('metaKeywords', e.target.value)}
                      helperText="Comma separated"
                      inputProps={{ maxLength: 500 }}
                    />
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Featured Image</Typography>
                  {imageStatus === 'generating' && (
                    <Stack alignItems="center" spacing={1} sx={{ py: 4, border: 1, borderColor: 'divider', borderRadius: 1, borderStyle: 'dashed' }}>
                      <CircularProgress size={28} />
                      <Typography variant="body2" color="text.secondary">Generating image…</Typography>
                    </Stack>
                  )}
                  {imageStatus !== 'generating' && (
                    <ImageUpload
                      key={imageKey}
                      label="Featured Image"
                      name="featuredImage"
                      currentImageUrl={imagePreview}
                      onChange={(file) => {
                        setFeaturedFile(file)
                        if (!file) setImagePreview('')
                      }}
                    />
                  )}
                  {imageStatus === 'ready' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Generated by Gemini. It is uploaded to the media store only when you save the draft.
                    </Typography>
                  )}
                  {imageStatus === 'failed' && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      {imageError} You can retry, or upload your own image above.
                    </Alert>
                  )}
                  {imageStatus === 'off' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Image generation is turned off. Upload a featured image above.
                    </Typography>
                  )}
                  {availability?.imageGenerationEnabled && imageStatus !== 'generating' && (
                    <Button
                      size="small" sx={{ mt: 1.5 }} startIcon={<ImageOutlined />}
                      onClick={() => generateImage({ title: form.title, summary: form.summary, prompt: imagePrompt })}
                      disabled={busy || !form.title.trim()}
                    >
                      {imageStatus === 'ready' ? 'Regenerate Image' : 'Generate Image'}
                    </Button>
                  )}
                  {!featuredFile && imageStatus !== 'generating' && (
                    <FormHelperText sx={{ mt: 1 }}>
                      A draft can be saved without an image, but one is needed before publishing.
                    </FormHelperText>
                  )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Details</Typography>
                  <Stack spacing={2.5}>
                    <TextField
                      label="Create Date" type="date" required fullWidth value={draftDate}
                      onChange={(e) => { setDraftDate(e.target.value); setFieldErrors((x) => ({ ...x, createDate: '' })) }}
                      error={!!fieldErrors.createDate}
                      helperText={fieldErrors.createDate || (draftDate ? `Saved as ${formatDay(draftDate)}` : '')}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      select label="Category" fullWidth value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                      error={!!fieldErrors.category}
                      helperText={fieldErrors.category || 'Suggested by Gemini from your existing categories'}
                    >
                      <MenuItem value="">Uncategorised</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c._id} value={c._id} disabled={!c.isActive}>
                          {c.name}{!c.isActive ? ' (disabled)' : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Tags" fullWidth value={form.tags}
                      onChange={(e) => setField('tags', e.target.value)}
                      helperText="Comma separated"
                    />
                    <TextField
                      label="Author" fullWidth value={form.author}
                      onChange={(e) => setField('author', e.target.value)}
                      inputProps={{ maxLength: 120 }}
                    />
                    <Divider />
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">Status after saving:</Typography>
                      <Chip label="Draft" size="small" />
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Regenerate blog"
        message={`Generate a new blog for "${topic.trim()}" dated ${createDate ? formatDay(createDate) : '—'}? Your edits to the current version will be replaced.`}
        confirmLabel="Regenerate"
        confirmColor="primary"
        onConfirm={() => { setConfirm(null); runGeneration() }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Discard generated blog"
        message="The generated blog has not been saved. Discard it?"
        confirmLabel="Discard"
        onConfirm={() => { setConfirm(null); reset() }}
        onCancel={() => setConfirm(null)}
      />
      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, open: false }))} />
    </Container>
  )
}

export default GeminiBlogsPage
