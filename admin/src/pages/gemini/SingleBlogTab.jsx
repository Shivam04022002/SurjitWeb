import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Stack, Typography, TextField, MenuItem, Button, FormControlLabel, Switch, Alert, AlertTitle,
  LinearProgress, Chip, Grid, CircularProgress
} from '@mui/material'
import { PlaylistAdd, AutoAwesome, Replay, Save, ClearAll, StopCircle } from '@mui/icons-material'
import ConfirmDialog from '../../components/ConfirmDialog'
import BlogQueueTable from './BlogQueueTable'
import RowEditDialog from './RowEditDialog'
import ReviewDialog from './ReviewDialog'
import useBlogQueue from './useBlogQueue'
import { newRow, counts, ids, hasUnsaved } from './blogQueueModel'
import { todayIST } from './geminiBlogUtils'

// Single Blog: one topic at a time. Add it to the list to generate later
// (nothing is sent to Gemini), or Generate Now to write it immediately and
// open the review.
const SingleBlogTab = ({ availability, categories, showToast }) => {
  const navigate = useNavigate()
  const queue = useBlogQueue({ availability, showToast })
  const { rows, run } = queue
  const c = counts(rows)
  const configured = !!availability?.configured
  const imagesOn = queue.imagesOn
  const active = categories.filter((x) => x.isActive)

  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(todayIST())
  const [category, setCategory] = useState('')
  const [withImage, setWithImage] = useState(true)
  const [formErrors, setFormErrors] = useState({})
  const [nowId, setNowId] = useState(null)
  const [nowError, setNowError] = useState('')

  const [editing, setEditing] = useState(null)
  const [reviewId, setReviewId] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const checkForm = () => {
    const e = {}
    if (topic.trim().length < 3) e.topic = 'Enter a blog name or topic (at least 3 characters)'
    if (!date) e.date = 'Choose a create date'
    setFormErrors(e)
    return !Object.keys(e).length
  }

  const formRow = () => newRow({
    source: 'single',
    input: { date, topic: topic.trim(), category, generateImage: withImage && imagesOn }
  })

  // Adds a row and returns it validated; an invalid one is taken back out and
  // its problems shown under the form instead.
  const addValidated = async (atStart) => {
    const [row] = await queue.addRows([formRow()], { atStart })
    if (row?.status === 'invalid') {
      await queue.removeRows([row.id])
      setFormErrors(Object.fromEntries(row.errors.map((e) => [e.field, e.message])))
      return null
    }
    return row
  }

  const addToList = async () => {
    if (!checkForm()) return
    const row = await addValidated(false)
    if (!row) return
    setTopic('')
    showToast('Added to the list')
  }

  const generateNow = async () => {
    if (!checkForm() || run) return
    setNowError('')
    const row = await addValidated(true)
    if (!row) return
    setNowId(row.id)
    setTopic('')
    await queue.generate([row.id])
    setNowId(null)
    const done = queue.rowsRef.current.find((r) => r.id === row.id)
    if (done?.form) setReviewId(row.id)
    else if (done?.error) setNowError(done.error)
  }

  const remove = (row) => {
    if (row.form && row.status !== 'saved') {
      setConfirm({
        title: 'Remove generated blog',
        message: `"${row.form.title}" has not been saved. Remove it from the list?`,
        confirmLabel: 'Remove',
        onConfirm: () => { queue.removeRows([row.id]); setReviewId(null) }
      })
    } else {
      queue.removeRows([row.id])
    }
  }

  const generateRow = (row) => {
    if (row.form) {
      setConfirm({
        title: 'Regenerate blog',
        message: 'Generate a new version of this blog? Your edits to the current version will be replaced.',
        confirmLabel: 'Regenerate',
        confirmColor: 'primary',
        onConfirm: () => queue.generate([row.id])
      })
    } else {
      queue.generate([row.id])
    }
  }

  const clearList = () => setConfirm({
    title: 'Clear the list',
    message: hasUnsaved(rows)
      ? 'Generated blogs that are not saved yet will be discarded. Saved drafts are not affected. Clear the list?'
      : 'Remove every row from the list? Saved drafts are not affected.',
    confirmLabel: 'Clear list',
    onConfirm: () => queue.replaceRows([])
  })

  const generatingNow = !!nowId && !!run
  const reviewRow = rows.find((r) => r.id === reviewId)

  return (
    <>
      {/* ── Create one blog ── */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Create one blog</Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={5}>
            <TextField
              label="Blog Name / Topic" required fullWidth size="small" value={topic}
              onChange={(e) => { setTopic(e.target.value); setFormErrors((x) => ({ ...x, topic: '' })) }}
              error={!!formErrors.topic}
              helperText={formErrors.topic || 'e.g. How an e-rickshaw loan helps drivers own their vehicle'}
              inputProps={{ maxLength: 200 }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label="Create Date" type="date" required fullWidth size="small" value={date}
              onChange={(e) => { setDate(e.target.value); setFormErrors((x) => ({ ...x, date: '' })) }}
              error={!!formErrors.date} helperText={formErrors.date || 'India time'}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              select label="Category" fullWidth size="small" value={category}
              onChange={(e) => { setCategory(e.target.value); setFormErrors((x) => ({ ...x, category: '' })) }}
              error={!!formErrors.category} helperText={formErrors.category || 'Optional'}
              SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}
            >
              <MenuItem value=""><em>Let Gemini choose</em></MenuItem>
              {active.map((x) => <MenuItem key={x._id} value={x._id}>{x.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControlLabel
              sx={{ mt: 0.25 }}
              control={<Switch checked={withImage && imagesOn} onChange={(e) => setWithImage(e.target.checked)} disabled={!imagesOn} />}
              label={<Typography variant="body2">Featured image</Typography>}
            />
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button variant="outlined" startIcon={<PlaylistAdd />} onClick={addToList} disabled={queue.validating || generatingNow}>
            Add to List
          </Button>
          <Button
            variant="contained" startIcon={generatingNow ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
            onClick={generateNow} disabled={!configured || !!run || queue.validating}
          >
            {generatingNow ? 'Generating…' : 'Generate Now'}
          </Button>
        </Stack>
        {generatingNow && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Generating… Gemini is writing the blog{withImage && imagesOn ? ', then an AI featured image is made for it (Nano Banana 2)' : ''}. This usually takes 30–90 seconds.
            </Typography>
          </Box>
        )}
        {nowError && !generatingNow && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setNowError('')}>
            <AlertTitle>Generation failed</AlertTitle>
            {nowError} The topic is kept in the list below — use Retry when ready.
          </Alert>
        )}
      </Paper>

      {/* ── Generation list ── */}
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" fontWeight={600}>Generation List</Typography>
            {!!rows.length && <Chip size="small" label={`${rows.length} topic${rows.length === 1 ? '' : 's'}`} />}
            {!!c.saved && <Chip size="small" color="success" label={`${c.saved} saved`} />}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {run ? (
              <Button color="warning" startIcon={<StopCircle />} onClick={queue.stop}>Stop after current</Button>
            ) : (
              <>
                <Button variant="contained" size="small" startIcon={<AutoAwesome />} onClick={() => queue.generate(ids(rows, ['pending']))}
                  disabled={!c.pending || !configured}>
                  Generate All{c.pending ? ` (${c.pending})` : ''}
                </Button>
                {!!c.gen_failed && (
                  <Button variant="outlined" size="small" color="error" startIcon={<Replay />} onClick={() => queue.generate(ids(rows, ['gen_failed']))}>
                    Retry Failed ({c.gen_failed})
                  </Button>
                )}
                {!!(c.readyToSave || c.save_failed) && (
                  <Button variant="contained" size="small" color="success" startIcon={<Save />}
                    onClick={() => queue.save(ids(rows, ['generated', 'save_failed']))}>
                    Save All as Drafts ({c.readyToSave + (c.save_failed || 0)})
                  </Button>
                )}
                <Button size="small" startIcon={<ClearAll />} onClick={clearList} disabled={!rows.length}>Clear List</Button>
              </>
            )}
          </Stack>
        </Box>
        {run && !generatingNow && (
          <Box sx={{ px: 2.5, pb: 1.5 }}>
            <LinearProgress variant="determinate" value={(run.done / run.total) * 100} sx={{ height: 6, borderRadius: 3 }} />
            <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
              {run.kind === 'generate' ? 'Generating' : 'Saving'} {Math.min(run.done + 1, run.total)} / {run.total}
            </Typography>
          </Box>
        )}
        {queue.pauseReason && (
          <Alert severity="warning" sx={{ mx: 2.5, mb: 1.5 }} onClose={() => queue.setPauseReason('')}>
            {queue.pauseReason} Rows not started are still pending; generate them when the limit resets.
          </Alert>
        )}
        <BlogQueueTable
          rows={rows}
          running={!!run}
          imagesOn={imagesOn}
          onEdit={(r) => setEditing(r)}
          onRemove={remove}
          onGenerate={generateRow}
          onReview={(r) => setReviewId(r.id)}
          onOpenDraft={(r) => navigate(`/blogs/${r.savedBlog._id}/edit`)}
          emptyText="No topics yet. Add one above to build a list, or Generate Now for a single blog."
        />
      </Paper>

      {editing && (
        <RowEditDialog
          row={editing}
          categories={categories}
          imagesOn={imagesOn}
          onClose={() => setEditing(null)}
          onSave={async (values) => { setEditing(null); await queue.editRow(editing.id, values) }}
        />
      )}
      {reviewRow && (
        <ReviewDialog
          queue={queue}
          row={reviewRow}
          categories={categories}
          showToast={showToast}
          onClose={() => setReviewId(null)}
          onDelete={(r) => setConfirm({
            title: 'Delete generated blog',
            message: 'Delete this generated blog? It has not been saved and cannot be recovered.',
            confirmLabel: 'Delete',
            onConfirm: () => { queue.removeRows([r.id]); setReviewId(null) }
          })}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        confirmColor={confirm?.confirmColor || 'error'}
        onConfirm={() => { const fn = confirm.onConfirm; setConfirm(null); fn() }}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

export default SingleBlogTab
