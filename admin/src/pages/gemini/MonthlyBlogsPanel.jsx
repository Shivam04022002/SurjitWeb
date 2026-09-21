import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, TextField, Button, Paper, Stack, MenuItem, Alert, AlertTitle, Chip, LinearProgress,
  CircularProgress, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import {
  CalendarMonth, PlaylistAdd, AutoAwesome, Save, Replay, EditNote, DeleteOutline, OpenInNew,
  Refresh, StopCircle, ImageOutlined, CheckCircle, ErrorOutline
} from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import GeneratedBlogEditor from './GeneratedBlogEditor'
import {
  todayIST, formatDay, errorMessage, base64ToFile, formFromGenerated, validateBlogForm,
  buildDraftFormData, splitList, newKey
} from './geminiBlogUtils'

// A month of blogs in three steps, each reviewable before the next:
//
//   1. Plan       Gemini proposes topics, dates, categories, tags, keywords.
//                 The admin edits the table.
//   2. Generate   Every row goes through the same generate/image endpoints as
//                 a single blog, two rows at a time.
//   3. Save       Every row goes through the same draft endpoint, with an
//                 idempotency key so a retry can never create a second draft.
//
// Rows fail independently. A failed row keeps its error and can be retried on
// its own; nothing already generated or saved is lost or repeated.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

const pad = (n) => String(n).padStart(2, '0')
const daysIn = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
const monthBounds = (monthKey) => ({ min: `${monthKey}-01`, max: `${monthKey}-${pad(daysIn(monthKey))}` })
const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

const STATUS = {
  planned: { label: 'Planned', color: 'default' },
  queued: { label: 'Queued', color: 'default', variant: 'outlined' },
  generating: { label: 'Generating…', color: 'info' },
  generated: { label: 'Generated', color: 'success', variant: 'outlined' },
  gen_failed: { label: 'Generation failed', color: 'error' },
  saving: { label: 'Saving…', color: 'info' },
  saved: { label: 'Draft saved', color: 'success' },
  save_failed: { label: 'Save failed', color: 'error' }
}

const HAS_CONTENT = ['generated', 'saving', 'saved', 'save_failed']

const newRow = ({ topic = '', createDate, category = null, tags = [], seoKeywords = [] }) => ({
  id: newKey('row'),
  topic,
  createDate,
  category: category?._id || '',
  tags: tags.join(', '),
  seoKeywords: seoKeywords.join(', '),
  status: 'planned',
  error: '',
  form: null,
  formVersion: 0,
  imagePrompt: '',
  warnings: [],
  image: { status: 'idle', preview: '', error: '', key: 0 },
  file: null,
  saveKey: null,
  savedBlog: null
})

const defaultMonth = () => {
  const [y, m] = todayIST().split('-').map(Number)
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}

const MonthlyBlogsPanel = ({ availability, categories, showToast }) => {
  const navigate = useNavigate()
  const limits = availability?.limits || { requestsPerWindow: 40, windowMinutes: 60, maxMonthlyBlogs: 31, maxParallel: 2 }
  const lanes = Math.max(1, Math.min(2, limits.maxParallel || 2))

  const initial = defaultMonth()
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [count, setCount] = useState(12)

  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')
  const [planWarnings, setPlanWarnings] = useState([])
  const [planMonth, setPlanMonth] = useState('')

  // Rows live in a ref as well as state: the generate and save queues read
  // and update them between renders, and must always see the latest values.
  const rowsRef = useRef([])
  const [rows, setRows] = useState([])
  const update = useCallback((fn) => {
    rowsRef.current = fn(rowsRef.current)
    setRows(rowsRef.current)
  }, [])
  const patch = useCallback((id, p) => update((list) => list.map((r) => (
    r.id === id ? { ...r, ...(typeof p === 'function' ? p(r) : p) } : r
  ))), [update])

  // { kind: 'generate' | 'save', done, total } while a queue runs.
  const [run, setRun] = useState(null)
  const [pauseReason, setPauseReason] = useState('')
  const stopRef = useRef(false)
  const planningRef = useRef(false)

  const [reviewId, setReviewId] = useState(null)
  const [reviewErrors, setReviewErrors] = useState({})
  const [confirmReplan, setConfirmReplan] = useState(false)

  // Leaving the page would discard generated-but-unsaved blogs.
  useEffect(() => {
    const unsaved = run || rows.some((r) => r.form && r.status !== 'saved')
    if (!unsaved) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [rows, run])

  const imageEnabled = !!availability?.imageGenerationEnabled
  const estimate = 1 + count * (imageEnabled ? 2 : 1)
  const running = !!run
  const [todayY] = todayIST().split('-').map(Number)
  const latestMonth = (() => {
    const d = new Date(`${todayIST()}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 365)
    return d.toISOString().slice(0, 7)
  })()

  // ── Plan ──────────────────────────────────────────────────────────────────

  const requestPlan = async () => {
    if (planningRef.current) return
    planningRef.current = true
    setPlanning(true)
    setPlanError('')
    setPauseReason('')
    try {
      const res = await geminiService.planMonth({ year, month, count })
      const plan = res.data
      update(() => plan.rows.map(newRow))
      setPlanMonth(plan.month)
      setPlanWarnings(plan.warnings || [])
      showToast(`${plan.rows.length} topics planned for ${monthLabel(plan.month)}`)
    } catch (err) {
      setPlanError(errorMessage(err, 'Could not generate the monthly plan. Please try again.'))
    } finally {
      planningRef.current = false
      setPlanning(false)
    }
  }

  const onPlanClick = () => {
    if (rowsRef.current.some((r) => r.form && r.status !== 'saved')) setConfirmReplan(true)
    else requestPlan()
  }

  // ── Row edits ─────────────────────────────────────────────────────────────
  // Before generation a row holds the plan; afterwards the table edits the
  // generated blog's own fields, so the table and the review dialog agree.

  const editRow = (id, field, value) => patch(id, (r) => {
    const next = { error: '' }
    if (field === 'createDate') return { ...next, createDate: value }
    if (!r.form) return { ...next, [field]: value }
    if (field === 'topic') return { ...next, form: { ...r.form, title: value } }
    if (field === 'category') return { ...next, form: { ...r.form, category: value } }
    if (field === 'tags') return { ...next, form: { ...r.form, tags: value } }
    if (field === 'seoKeywords') return { ...next, form: { ...r.form, seo: { ...r.form.seo, metaKeywords: value } } }
    return next
  })

  const cell = (r, field) => {
    if (!r.form) return r[field]
    if (field === 'topic') return r.form.title
    if (field === 'category') return r.form.category
    if (field === 'tags') return r.form.tags
    if (field === 'seoKeywords') return r.form.seo.metaKeywords
    return r[field]
  }

  const addRow = () => {
    const { min } = monthBounds(planMonth)
    update((list) => [...list, newRow({ createDate: min })])
  }

  const removeRow = (id) => update((list) => list.filter((r) => r.id !== id))

  const inMonth = (date) => !!date && date.startsWith(`${planMonth}-`)

  // ── Queue ─────────────────────────────────────────────────────────────────
  // At most `lanes` rows are in flight; each lane takes the next row when it
  // finishes one. Stopping (by the admin, or on a rate limit) lets rows that
  // already started finish and returns the rest to where they were.

  const runQueue = async (kind, ids, worker, restore) => {
    stopRef.current = false
    setPauseReason('')
    setRun({ kind, done: 0, total: ids.length })
    let next = 0
    const lane = async () => {
      while (next < ids.length && !stopRef.current) {
        const id = ids[next++]
        await worker(id)
        setRun((r) => (r ? { ...r, done: r.done + 1 } : r))
      }
    }
    await Promise.all(Array.from({ length: Math.min(lanes, ids.length) }, lane))
    update((list) => list.map((r) => (r.status === 'queued' ? { ...r, status: restore(r) } : r)))
    setRun(null)
  }

  const onRateLimit = (err) => {
    if (err?.response?.status === 429) {
      stopRef.current = true
      setPauseReason(errorMessage(err, 'Gemini request limit reached.'))
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  const generateRowImage = async (id) => {
    const row = rowsRef.current.find((r) => r.id === id)
    if (!row?.form || row.image.status === 'generating') return
    patch(id, (r) => ({ image: { ...r.image, status: 'generating', error: '' } }))
    try {
      const res = await geminiService.generateImage({
        title: row.form.title, summary: row.form.summary, imagePrompt: row.imagePrompt, rowKey: row.id
      })
      const { data, mimeType } = res.data.image
      patch(id, (r) => ({
        file: base64ToFile(data, mimeType),
        image: { status: 'ready', preview: `data:${mimeType};base64,${data}`, error: '', key: r.image.key + 1 }
      }))
    } catch (err) {
      patch(id, (r) => ({ image: { ...r.image, status: 'failed', error: errorMessage(err, 'The featured image could not be generated.') } }))
      onRateLimit(err)
    }
  }

  const generateRow = async (id) => {
    const row = rowsRef.current.find((r) => r.id === id)
    if (!row) return
    patch(id, { status: 'generating', error: '' })
    try {
      const res = await geminiService.generateBlog({
        topic: row.topic.trim(),
        createDate: row.createDate,
        category: row.category || undefined,
        tags: splitList(row.tags),
        seoKeywords: splitList(row.seoKeywords),
        rowKey: row.id
      })
      const result = res.data
      patch(id, (r) => ({
        status: 'generated',
        form: formFromGenerated(result.blog),
        formVersion: r.formVersion + 1,
        imagePrompt: result.imagePrompt || '',
        warnings: result.warnings || [],
        // A new version of the blog is a new save request.
        saveKey: newKey('save'),
        file: null,
        image: { status: result.imageGenerationEnabled ? 'idle' : 'off', preview: '', error: '', key: r.image.key + 1 }
      }))
      if (result.imageGenerationEnabled) {
        if (stopRef.current) {
          patch(id, (r) => ({ image: { ...r.image, status: 'failed', error: 'Stopped before the image was generated.' } }))
        } else {
          await generateRowImage(id)
        }
      }
    } catch (err) {
      patch(id, { status: 'gen_failed', error: errorMessage(err, 'Generation failed.') })
      onRateLimit(err)
    }
  }

  const startGeneration = (targetStatuses) => {
    const targets = rowsRef.current.filter((r) => targetStatuses.includes(r.status))
    const invalid = []
    targets.forEach((r) => {
      if (r.topic.trim().length < 3) invalid.push([r.id, 'Enter a topic of at least 3 characters.'])
      else if (!inMonth(r.createDate)) invalid.push([r.id, `Choose a date in ${monthLabel(planMonth)}.`])
    })
    invalid.forEach(([id, error]) => patch(id, { error }))
    const ids = targets.filter((r) => !invalid.some(([id]) => id === r.id)).map((r) => r.id)
    if (!ids.length) {
      if (invalid.length) showToast('Fix the highlighted rows first', 'error')
      return
    }
    update((list) => list.map((r) => (ids.includes(r.id) ? { ...r, status: 'queued', error: '' } : r)))
    runQueue('generate', ids, generateRow, (r) => (r.form ? 'gen_failed' : 'planned')).then(() => {
      const failed = rowsRef.current.filter((r) => ids.includes(r.id) && r.status === 'gen_failed').length
      if (!failed) showToast(`${ids.length} blog${ids.length === 1 ? '' : 's'} generated`)
    })
  }

  const regenerateRow = (id) => {
    update((list) => list.map((r) => (r.id === id ? { ...r, status: 'queued', error: '' } : r)))
    runQueue('generate', [id], generateRow, (r) => (r.form ? 'generated' : 'planned'))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveRow = async (id) => {
    const row = rowsRef.current.find((r) => r.id === id)
    if (!row?.form) return
    const errs = validateBlogForm(row.form, row.createDate)
    if (!inMonth(row.createDate)) errs.createDate = `Date must be in ${monthLabel(planMonth)}`
    if (Object.keys(errs).length) {
      patch(id, { status: 'save_failed', error: `Fix before saving: ${Object.values(errs).join('; ')}` })
      return
    }
    patch(id, { status: 'saving', error: '' })
    try {
      const res = await geminiService.saveDraft(buildDraftFormData(row.form, row.createDate, row.file, {
        planMonth, idempotencyKey: row.saveKey
      }))
      patch(id, { status: 'saved', savedBlog: res.data.blog, error: '' })
    } catch (err) {
      const fields = (err?.response?.data?.errors || []).map((e) => e.message)
      patch(id, { status: 'save_failed', error: [errorMessage(err, 'Save failed.'), ...fields].join(' — ') })
    }
  }

  const startSaving = (targetStatuses) => {
    const targets = rowsRef.current.filter((r) => targetStatuses.includes(r.status) && r.form && r.image.status !== 'generating')
    if (!targets.length) return

    // Two rows with near-identical titles can arrive with the same slug; the
    // later one gets a suffix so the batch does not fail on its own clash.
    const used = new Set(rowsRef.current.filter((r) => r.status === 'saved').map((r) => r.savedBlog?.slug))
    const renamed = {}
    targets.forEach((r) => {
      let slug = r.form.slug
      for (let n = 2; used.has(slug); n++) slug = `${r.form.slug}-${n}`
      used.add(slug)
      if (slug !== r.form.slug) renamed[r.id] = slug
    })
    const ids = targets.map((r) => r.id)
    update((list) => list.map((r) => {
      if (!ids.includes(r.id)) return r
      const form = renamed[r.id] ? { ...r.form, slug: renamed[r.id] } : r.form
      return { ...r, form, status: 'queued', error: '' }
    }))
    runQueue('save', ids, saveRow, () => 'generated').then(() => {
      const saved = rowsRef.current.filter((r) => ids.includes(r.id) && r.status === 'saved').length
      showToast(saved === ids.length ? `${saved} draft${saved === 1 ? '' : 's'} saved` : `${saved} of ${ids.length} drafts saved`,
        saved === ids.length ? 'success' : 'warning')
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const counts = rows.reduce((c, r) => {
    c[r.status] = (c[r.status] || 0) + 1
    if (HAS_CONTENT.includes(r.status)) c.withContent++
    return c
  }, { withContent: 0 })
  const readyToSave = rows.filter((r) => r.status === 'generated' && r.image.status !== 'generating').length
  const withoutImage = rows.filter((r) => r.form && r.status !== 'saved' && !r.file && r.image.status !== 'generating').length
  const bounds = planMonth ? monthBounds(planMonth) : { min: '', max: '' }
  const reviewRow = rows.find((r) => r.id === reviewId)
  const progressLabel = run
    ? `${run.kind === 'generate' ? 'Generating' : 'Saving'} ${Math.min(run.done + 1, run.total)}/${run.total}`
    : ''

  return (
    <>
      {/* ── Month selection ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
          <TextField
            select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}
            sx={{ minWidth: 170 }} disabled={planning || running}
          >
            {MONTHS.map((name, i) => (
              <MenuItem key={name} value={i + 1} disabled={`${year}-${pad(i + 1)}` > latestMonth}>{name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}
            sx={{ minWidth: 120 }} disabled={planning || running}
          >
            {[todayY - 1, todayY, todayY + 1].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <TextField
            label="Number of blogs" type="number" value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(limits.maxMonthlyBlogs, Number(e.target.value) || 1)))}
            inputProps={{ min: 1, max: limits.maxMonthlyBlogs }}
            sx={{ width: 160 }} disabled={planning || running}
            helperText={`1–${limits.maxMonthlyBlogs}`}
          />
          <Button
            variant="contained" size="large" sx={{ height: 56, px: 3 }}
            startIcon={planning ? <CircularProgress size={18} color="inherit" /> : <CalendarMonth />}
            onClick={onPlanClick}
            disabled={planning || running || !availability?.configured || `${year}-${pad(month)}` > latestMonth}
          >
            {planning ? 'Planning…' : 'Generate Monthly Blogs'}
          </Button>
        </Stack>
        <Typography variant="caption" color={estimate > limits.requestsPerWindow ? 'warning.main' : 'text.secondary'} sx={{ display: 'block', mt: 1.5 }}>
          A month of {count} blog{count === 1 ? '' : 's'} takes about {estimate} Gemini requests
          ({imageEnabled ? 'plan, text and image per blog' : 'plan and text per blog'}). Your limit is {limits.requestsPerWindow} per {limits.windowMinutes} minutes
          {estimate > limits.requestsPerWindow ? ' — the rest will pause and can be retried later.' : '.'}
        </Typography>
        {planning && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Planning {count} topics for {MONTHS[month - 1]} {year}…
            </Typography>
          </Box>
        )}
        {planError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setPlanError('')}>
            <AlertTitle>Planning failed</AlertTitle>
            {planError}
          </Alert>
        )}
      </Paper>

      {/* ── Schedule ── */}
      {planMonth && (
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Monthly Schedule — {monthLabel(planMonth)}</Typography>
              <Typography variant="body2" color="text.secondary">
                Edit topics, dates and categories, then generate. Every blog is saved as a draft; nothing is published.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {running ? (
                <Button color="warning" startIcon={<StopCircle />} onClick={() => { stopRef.current = true }}>
                  Stop after current
                </Button>
              ) : (
                <>
                  <Button startIcon={<PlaylistAdd />} onClick={addRow}>Add row</Button>
                  <Button
                    variant="contained" startIcon={<AutoAwesome />}
                    onClick={() => startGeneration(['planned'])}
                    disabled={!counts.planned || !availability?.configured}
                  >
                    Generate All Blogs{counts.planned ? ` (${counts.planned})` : ''}
                  </Button>
                  {!!counts.gen_failed && (
                    <Button variant="outlined" color="error" startIcon={<Replay />} onClick={() => startGeneration(['gen_failed'])}>
                      Retry Failed ({counts.gen_failed})
                    </Button>
                  )}
                  <Button
                    variant="contained" color="success" startIcon={<Save />}
                    onClick={() => startSaving(['generated'])}
                    disabled={!readyToSave}
                  >
                    Save All as Drafts{readyToSave ? ` (${readyToSave})` : ''}
                  </Button>
                  {!!counts.save_failed && (
                    <Button variant="outlined" color="error" startIcon={<Replay />} onClick={() => startSaving(['save_failed'])}>
                      Retry Failed Saves ({counts.save_failed})
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </Box>

          {run && (
            <Box sx={{ px: 2.5, pb: 2 }}>
              <LinearProgress variant="determinate" value={(run.done / run.total) * 100} sx={{ height: 6, borderRadius: 3 }} />
              <Typography variant="body2" sx={{ mt: 1 }} fontWeight={600}>{progressLabel}</Typography>
            </Box>
          )}

          {!run && counts.withContent > 0 && (
            <Box sx={{ px: 2.5, pb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" icon={<CheckCircle />} color="success" variant="outlined" label={`${counts.withContent} generated`} />
                <Chip size="small" color="primary" variant="outlined" label={`${readyToSave} ready to save`} />
                {!!counts.saved && <Chip size="small" color="success" label={`${counts.saved} saved as drafts`} />}
                {!!withoutImage && (
                  <Tooltip title="These drafts can be saved without a featured image, but each needs one before publishing. Add it in Review.">
                    <Chip size="small" icon={<ImageOutlined />} color="warning" variant="outlined" label={`${withoutImage} without image`} />
                  </Tooltip>
                )}
                {!!(counts.gen_failed || counts.save_failed) && (
                  <Chip size="small" icon={<ErrorOutline />} color="error" variant="outlined"
                    label={`${(counts.gen_failed || 0) + (counts.save_failed || 0)} failed`} />
                )}
              </Stack>
            </Box>
          )}

          {pauseReason && (
            <Alert severity="warning" sx={{ mx: 2.5, mb: 2 }} onClose={() => setPauseReason('')}>
              <AlertTitle>Paused</AlertTitle>
              {pauseReason} Rows not yet started are unchanged; use Generate All or Retry Failed when the limit resets.
            </Alert>
          )}
          {planWarnings.length > 0 && (
            <Alert severity="info" sx={{ mx: 2.5, mb: 2 }} onClose={() => setPlanWarnings([])}>
              {planWarnings.map((w) => <div key={w}>{w}</div>)}
            </Alert>
          )}

          <TableContainer sx={{ maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1300 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>#</TableCell>
                  <TableCell sx={{ minWidth: 280 }}>Blog Name / Topic</TableCell>
                  <TableCell sx={{ width: 160 }}>Create Date</TableCell>
                  <TableCell sx={{ width: 180 }}>Category</TableCell>
                  <TableCell sx={{ minWidth: 170 }}>Tags</TableCell>
                  <TableCell sx={{ minWidth: 190 }}>SEO Keywords</TableCell>
                  <TableCell sx={{ width: 76 }}>Image</TableCell>
                  <TableCell sx={{ width: 190 }}>Status</TableCell>
                  <TableCell sx={{ width: 120 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => {
                  const locked = running || ['queued', 'generating', 'saving', 'saved'].includes(r.status)
                  const st = STATUS[r.status]
                  return (
                    <TableRow key={r.id} hover sx={{ verticalAlign: 'top' }}>
                      <TableCell sx={{ pt: 2 }}>{i + 1}</TableCell>
                      <TableCell>
                        <TextField
                          size="small" fullWidth multiline maxRows={3} value={cell(r, 'topic')}
                          onChange={(e) => editRow(r.id, 'topic', e.target.value)}
                          disabled={locked}
                          placeholder="Blog topic"
                          inputProps={{ maxLength: r.form ? 250 : 200, 'aria-label': `Topic for row ${i + 1}` }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" type="date" fullWidth value={r.createDate}
                          onChange={(e) => editRow(r.id, 'createDate', e.target.value)}
                          disabled={locked}
                          error={!inMonth(r.createDate)}
                          inputProps={{ min: bounds.min, max: bounds.max, 'aria-label': `Create date for row ${i + 1}` }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select size="small" fullWidth value={cell(r, 'category')}
                          onChange={(e) => editRow(r.id, 'category', e.target.value)}
                          disabled={locked}
                          SelectProps={{ displayEmpty: true }}
                          inputProps={{ 'aria-label': `Category for row ${i + 1}` }}
                        >
                          <MenuItem value=""><em>Let Gemini choose</em></MenuItem>
                          {categories.map((c) => (
                            <MenuItem key={c._id} value={c._id} disabled={!c.isActive}>
                              {c.name}{!c.isActive ? ' (disabled)' : ''}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" fullWidth multiline maxRows={3} value={cell(r, 'tags')}
                          onChange={(e) => editRow(r.id, 'tags', e.target.value)}
                          disabled={locked} placeholder="Comma separated"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" fullWidth multiline maxRows={3} value={cell(r, 'seoKeywords')}
                          onChange={(e) => editRow(r.id, 'seoKeywords', e.target.value)}
                          disabled={locked} placeholder="Comma separated"
                        />
                      </TableCell>
                      <TableCell sx={{ pt: 1.5 }}>
                        {r.image.status === 'generating' && <CircularProgress size={20} />}
                        {r.image.status !== 'generating' && r.image.preview && r.file && (
                          <Box component="img" src={r.image.preview} alt="" sx={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 0.5, display: 'block' }} />
                        )}
                        {r.image.status !== 'generating' && !r.image.preview && r.file && (
                          <Tooltip title="Uploaded image"><CheckCircle color="success" fontSize="small" /></Tooltip>
                        )}
                        {r.form && !r.file && r.image.status !== 'generating' && (
                          <Tooltip title={r.image.error || 'No image yet — add one in Review'}>
                            <ImageOutlined color={r.image.status === 'failed' ? 'warning' : 'disabled'} fontSize="small" />
                          </Tooltip>
                        )}
                        {!r.form && <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell sx={{ pt: 1.5 }}>
                        <Chip
                          size="small" label={st.label} color={st.color} variant={st.variant || 'filled'}
                          icon={['generating', 'saving'].includes(r.status) ? <CircularProgress size={12} color="inherit" /> : undefined}
                        />
                        {r.error && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{r.error}</Typography>
                        )}
                        {!r.error && r.warnings.length > 0 && r.status === 'generated' && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>{r.warnings[0]}</Typography>
                        )}
                        {r.status === 'saved' && r.savedBlog && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Dated {formatDay(r.createDate, { day: 'numeric', month: 'short' })}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ pt: 1, whiteSpace: 'nowrap' }}>
                        {r.status === 'saved' && r.savedBlog ? (
                          <Tooltip title="Open draft in the blog editor">
                            <IconButton size="small" onClick={() => navigate(`/blogs/${r.savedBlog._id}/edit`)}><OpenInNew fontSize="small" /></IconButton>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title="Review and edit">
                              <span>
                                <IconButton size="small" onClick={() => { setReviewErrors({}); setReviewId(r.id) }} disabled={!r.form || running}>
                                  <EditNote fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Regenerate this blog">
                              <span>
                                <IconButton size="small" onClick={() => regenerateRow(r.id)}
                                  disabled={running || !['generated', 'gen_failed', 'save_failed'].includes(r.status) || r.image.status === 'generating'}>
                                  <Refresh fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Remove row">
                              <span>
                                <IconButton size="small" onClick={() => removeRow(r.id)} disabled={locked}>
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No rows. Add one, or generate the plan again.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Review one generated blog ── */}
      <Dialog open={!!reviewRow} onClose={() => setReviewId(null)} maxWidth="xl" fullWidth scroll="paper">
        {reviewRow && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              Review blog #{rows.indexOf(reviewRow) + 1}
              <Chip size="small" label="Draft" />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                Changes are kept with the row and saved by Save All as Drafts
              </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
              {reviewRow.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>{reviewRow.warnings.map((w) => <div key={w}>{w}</div>)}</Alert>
              )}
              <GeneratedBlogEditor
                key={`${reviewRow.id}-${reviewRow.formVersion}`}
                form={reviewRow.form}
                onFormChange={(u) => patch(reviewRow.id, (r) => ({ form: typeof u === 'function' ? u(r.form) : u }))}
                errors={reviewErrors}
                onClearError={(name) => setReviewErrors((e) => ({ ...e, [name]: '' }))}
                categories={categories}
                createDate={reviewRow.createDate}
                onCreateDateChange={(v) => patch(reviewRow.id, { createDate: v })}
                dateMin={bounds.min}
                dateMax={bounds.max}
                image={reviewRow.image}
                hasImageFile={!!reviewRow.file}
                imageEnabled={imageEnabled}
                // An uploaded file gets a local preview so the table and a
                // reopened dialog show it; it is still sent only on save.
                onImageFile={(file) => patch(reviewRow.id, (r) => ({
                  file,
                  image: { ...r.image, preview: file ? URL.createObjectURL(file) : '', status: file ? 'idle' : r.image.status, error: '' }
                }))}
                onGenerateImage={() => generateRowImage(reviewRow.id)}
                disabled={reviewRow.status === 'saving'}
                showToast={showToast}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  const errs = validateBlogForm(reviewRow.form, reviewRow.createDate)
                  if (!inMonth(reviewRow.createDate)) errs.createDate = `Date must be in ${monthLabel(planMonth)}`
                  setReviewErrors(errs)
                  if (Object.keys(errs).length) {
                    showToast('Please fix the highlighted fields', 'error')
                    return
                  }
                  setReviewId(null)
                }}
                variant="contained"
              >
                Done
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmReplan}
        title="Replace the monthly plan"
        message="Generated blogs that are not saved yet will be discarded. Saved drafts are not affected. Continue?"
        confirmLabel="Replace plan"
        onConfirm={() => { setConfirmReplan(false); requestPlan() }}
        onCancel={() => setConfirmReplan(false)}
      />
    </>
  )
}

export default MonthlyBlogsPanel
