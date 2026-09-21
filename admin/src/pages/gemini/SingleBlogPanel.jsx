import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, TextField, Button, Grid, Paper, Stack, Alert, AlertTitle,
  CircularProgress, LinearProgress, Chip
} from '@mui/material'
import { AutoAwesome, Save, Refresh, Close, OpenInNew, CheckCircle } from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import GeneratedBlogEditor from './GeneratedBlogEditor'
import {
  todayIST, formatDay, errorMessage, base64ToFile, formFromGenerated, validateBlogForm, buildDraftFormData
} from './geminiBlogUtils'

// One topic + one date -> one generated blog -> one draft.
const SingleBlogPanel = ({ availability, categories, showToast }) => {
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [createDate, setCreateDate] = useState(todayIST())
  const [requestErrors, setRequestErrors] = useState({})

  // idle -> generating -> generated -> saving -> saved
  const [phase, setPhase] = useState('idle')
  const [genError, setGenError] = useState('')
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(0)
  const [draftDate, setDraftDate] = useState('')
  const [warnings, setWarnings] = useState([])
  const [imagePrompt, setImagePrompt] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const [featuredFile, setFeaturedFile] = useState(null)
  const [image, setImage] = useState({ status: 'idle', preview: '', error: '', key: 0 })

  const [savedBlog, setSavedBlog] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'regenerate' | 'cancel'

  // Guards against a second request starting before React re-renders the
  // disabled button (a fast double click). The server refuses duplicates too.
  const generatingRef = useRef(false)
  const imageRef = useRef(false)

  const generateImage = useCallback(async ({ title, summary, prompt }) => {
    if (imageRef.current) return
    imageRef.current = true
    setImage((i) => ({ ...i, status: 'generating', error: '' }))
    try {
      const res = await geminiService.generateImage({ title, summary, imagePrompt: prompt })
      const { data, mimeType } = res.data.image
      setFeaturedFile(base64ToFile(data, mimeType))
      setImage((i) => ({ status: 'ready', preview: `data:${mimeType};base64,${data}`, error: '', key: i.key + 1 }))
    } catch (err) {
      setImage((i) => ({ ...i, status: 'failed', error: errorMessage(err, 'The featured image could not be generated.') }))
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
      setVersion((v) => v + 1)
      setDraftDate(result.createDate)
      setWarnings(result.warnings || [])
      setImagePrompt(result.imagePrompt || '')
      setFieldErrors({})
      setFeaturedFile(null)
      setImage((i) => ({ status: result.imageGenerationEnabled ? 'idle' : 'off', preview: '', error: '', key: i.key + 1 }))
      setPhase('generated')

      if (result.imageGenerationEnabled) {
        generateImage({ title: result.blog.title, summary: result.blog.summary, prompt: result.imagePrompt })
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

  const saveDraft = async () => {
    if (phase === 'saving') return
    const errs = validateBlogForm(form, draftDate)
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      showToast('Please fix the highlighted fields', 'error')
      return
    }
    setPhase('saving')
    try {
      const res = await geminiService.saveDraft(buildDraftFormData(form, draftDate, featuredFile))
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
    setImage((i) => ({ status: 'idle', preview: '', error: '', key: i.key + 1 }))
    setSavedBlog(null)
    setTopic('')
    setCreateDate(todayIST())
  }

  const generating = phase === 'generating'
  const saving = phase === 'saving'
  const busy = generating || saving
  const imageBusy = image.status === 'generating'

  return (
    <>
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
              <Button startIcon={<Close />} onClick={() => setConfirm('cancel')} disabled={busy || imageBusy}>Cancel</Button>
              <Button
                variant="outlined"
                startIcon={generating ? <CircularProgress size={16} /> : <Refresh />}
                onClick={() => setConfirm('regenerate')}
                disabled={busy || imageBusy}
              >
                {generating ? 'Generating…' : 'Regenerate'}
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                onClick={saveDraft}
                disabled={busy || imageBusy}
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

          <GeneratedBlogEditor
            key={version}
            form={form}
            onFormChange={setForm}
            errors={fieldErrors}
            onClearError={(name) => setFieldErrors((e) => ({ ...e, [name]: '' }))}
            categories={categories}
            createDate={draftDate}
            onCreateDateChange={setDraftDate}
            image={image}
            hasImageFile={!!featuredFile}
            imageEnabled={availability?.imageGenerationEnabled}
            onImageFile={(file) => {
              setFeaturedFile(file)
              if (!file) setImage((i) => ({ ...i, preview: '' }))
            }}
            onGenerateImage={() => generateImage({ title: form.title, summary: form.summary, prompt: imagePrompt })}
            disabled={generating}
            showToast={showToast}
          />
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
    </>
  )
}

export default SingleBlogPanel
