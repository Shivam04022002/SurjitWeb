import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Stack, Typography, Button, Alert, AlertTitle, LinearProgress, Chip, CircularProgress, Tooltip
} from '@mui/material'
import {
  UploadFile, Download, AutoAwesome, Replay, Save, PlaylistAdd, DeleteSweep, ClearAll, StopCircle,
  CheckCircle, ErrorOutline, ImageOutlined, Description
} from '@mui/icons-material'
import { geminiService } from '../../services/gemini.service'
import ConfirmDialog from '../../components/ConfirmDialog'
import BlogQueueTable from './BlogQueueTable'
import RowEditDialog from './RowEditDialog'
import ReviewDialog from './ReviewDialog'
import useBlogQueue from './useBlogQueue'
import { newRow, fromValidated, counts, ids, hasUnsaved } from './blogQueueModel'
import { errorMessage } from './geminiBlogUtils'

const ACCEPT = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
const MAX_MB = 2

// Bulk Upload: a month's plan from Excel.
//
//   Upload -> validate (server) -> preview & edit -> Generate All
//   -> review -> Save All as Drafts -> publish later from All Blogs
//
// Uploading only reads the file into a plan; nothing reaches Gemini until
// Generate All, and only valid rows are generated.
const BulkUploadTab = ({ availability, categories, showToast }) => {
  const navigate = useNavigate()
  const queue = useBlogQueue({ availability, showToast })
  const { rows, run } = queue
  const c = counts(rows)
  const configured = !!availability?.configured
  const fileInput = useRef(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [fileInfo, setFileInfo] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [editing, setEditing] = useState(null) // a row, or {} for a new one
  const [reviewId, setReviewId] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // ── Upload ──────────────────────────────────────────────────────────────────

  const readFile = async (file) => {
    if (!file) return
    setUploadError('')
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setUploadError('Choose an Excel file (.xlsx or .xls).')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`The file is larger than ${MAX_MB} MB.`)
      return
    }
    setUploading(true)
    try {
      const res = await geminiService.parseBulkFile(file)
      const plan = res.data
      queue.replaceRows(plan.rows.map((v) => fromValidated(v, 'excel')))
      setFileInfo(plan.file)
      showToast(res.message || 'Plan imported', plan.summary.invalid ? 'warning' : 'success')
    } catch (err) {
      setUploadError(errorMessage(err, 'The file could not be imported.'))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const chooseFile = () => {
    if (hasUnsaved(rows)) {
      setConfirm({
        title: 'Replace the current plan',
        message: 'Generated blogs that are not saved yet will be discarded. Saved drafts are not affected. Upload a new file?',
        confirmLabel: 'Choose file',
        confirmColor: 'primary',
        onConfirm: () => fileInput.current?.click()
      })
    } else {
      fileInput.current?.click()
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (run || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (hasUnsaved(rows)) {
      setConfirm({
        title: 'Replace the current plan',
        message: 'Generated blogs that are not saved yet will be discarded. Saved drafts are not affected. Import this file?',
        confirmLabel: 'Import',
        confirmColor: 'primary',
        onConfirm: () => readFile(file)
      })
    } else {
      readFile(file)
    }
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const blob = await geminiService.downloadBulkTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gemini-blog-plan-template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      showToast('Could not download the template', 'error')
    } finally {
      setDownloading(false)
    }
  }

  // ── Row actions ─────────────────────────────────────────────────────────────

  const saveEdit = async (values) => {
    const target = editing
    setEditing(null)
    if (target?.id) {
      await queue.editRow(target.id, values)
    } else {
      await queue.addRows([newRow({ source: 'manual', input: values })])
    }
  }

  const remove = (row) => {
    if (row.form && row.status !== 'saved') {
      setConfirm({
        title: 'Remove generated blog',
        message: `"${row.form.title}" has not been saved. Remove it from the plan?`,
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

  const removeInvalid = () => setConfirm({
    title: 'Remove invalid rows',
    message: `Remove the ${c.invalid} invalid row${c.invalid === 1 ? '' : 's'} from the plan? The file itself is not changed.`,
    confirmLabel: 'Remove invalid',
    onConfirm: () => queue.removeRows(ids(rows, ['invalid']))
  })

  const clearPlan = () => setConfirm({
    title: 'Clear the plan',
    message: hasUnsaved(rows)
      ? 'Generated blogs that are not saved yet will be discarded. Saved drafts are not affected. Clear the plan?'
      : 'Clear the imported plan? Saved drafts are not affected.',
    confirmLabel: 'Clear',
    onConfirm: () => { queue.replaceRows([]); setFileInfo(null) }
  })

  const reviewRow = rows.find((r) => r.id === reviewId)
  const hasPlan = rows.length > 0 || !!fileInfo

  return (
    <>
      <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => readFile(e.target.files?.[0])} />

      {/* ── Upload ── */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ md: 'center' }}>
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            sx={{
              flex: 1, p: 2.5, borderRadius: 2, border: 2, borderStyle: 'dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              bgcolor: dragOver ? 'action.hover' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 2, transition: 'all 120ms'
            }}
          >
            {uploading ? <CircularProgress size={36} /> : <UploadFile color="primary" sx={{ fontSize: 40 }} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600}>Upload Monthly Blog Excel</Typography>
              <Typography variant="body2" color="text.secondary">
                {uploading ? 'Reading and validating the file…' : 'Drag an .xlsx or .xls file here, or choose one. Columns: Date | Blog Topic | Category | Generate Image.'}
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<UploadFile />} onClick={chooseFile} disabled={uploading || !!run}>
              {hasPlan ? 'Re-upload' : 'Choose Excel File'}
            </Button>
          </Box>
          <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Button variant="outlined" startIcon={downloading ? <CircularProgress size={16} /> : <Download />} onClick={downloadTemplate} disabled={downloading}>
              Download Template
            </Button>
            <Typography variant="caption" color="text.secondary">Includes your active categories</Typography>
          </Stack>
        </Stack>
        {uploadError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setUploadError('')}>
            <AlertTitle>The file could not be imported</AlertTitle>
            {uploadError}
          </Alert>
        )}
      </Paper>

      {/* ── Plan ── */}
      {hasPlan ? (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Box sx={{ p: 2.5, pb: 1.5 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ lg: 'center' }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>Monthly Blog Plan</Typography>
                  {fileInfo && <Chip size="small" icon={<Description />} label={fileInfo.name} variant="outlined" />}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${c.total} rows`} />
                  <Chip size="small" color="success" variant="outlined" icon={<CheckCircle />} label={`${c.valid} valid`} />
                  <Chip size="small" color={c.invalid ? 'error' : 'default'} variant="outlined" icon={<ErrorOutline />} label={`${c.invalid} invalid`} />
                  <Chip size="small" variant="outlined" icon={<ImageOutlined />}
                    label={`${c.imagesRequested} image${c.imagesRequested === 1 ? '' : 's'} requested${queue.imagesOn ? '' : ' (turned off)'}`} />
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {run ? (
                  <Button color="warning" startIcon={<StopCircle />} onClick={queue.stop}>Stop after current</Button>
                ) : (
                  <>
                    <Tooltip title={c.invalid && !c.pending ? 'Fix or remove invalid rows first' : ''}>
                      <span>
                        <Button variant="contained" startIcon={<AutoAwesome />} onClick={() => queue.generate(ids(rows, ['pending']))}
                          disabled={!c.pending || !configured || queue.validating}>
                          Generate All{c.pending ? ` (${c.pending})` : ''}
                        </Button>
                      </span>
                    </Tooltip>
                    {!!c.gen_failed && (
                      <Button variant="outlined" color="error" startIcon={<Replay />} onClick={() => queue.generate(ids(rows, ['gen_failed']))}>
                        Retry Failed ({c.gen_failed})
                      </Button>
                    )}
                    {!!(c.readyToSave || c.save_failed) && (
                      <Button variant="contained" color="success" startIcon={<Save />} onClick={() => queue.save(ids(rows, ['generated', 'save_failed']))}>
                        Save All as Drafts ({c.readyToSave + (c.save_failed || 0)})
                      </Button>
                    )}
                    <Button startIcon={<PlaylistAdd />} onClick={() => setEditing({})}>Add Row</Button>
                    {!!c.invalid && <Button color="error" startIcon={<DeleteSweep />} onClick={removeInvalid}>Remove Invalid ({c.invalid})</Button>}
                    <Button startIcon={<ClearAll />} onClick={clearPlan}>Clear</Button>
                  </>
                )}
              </Stack>
            </Stack>
          </Box>

          {run && (
            <Box sx={{ px: 2.5, pb: 1.5 }}>
              <LinearProgress variant="determinate" value={(run.done / run.total) * 100} sx={{ height: 6, borderRadius: 3 }} />
              <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
                {run.kind === 'generate' ? 'Generating' : 'Saving'} {Math.min(run.done + 1, run.total)} / {run.total}
              </Typography>
            </Box>
          )}
          {!run && c.withContent > 0 && (
            <Stack direction="row" spacing={1} sx={{ px: 2.5, pb: 1.5 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" color="success" variant="outlined" label={`${c.withContent} generated`} />
              <Chip size="small" color="primary" variant="outlined" label={`${c.readyToSave} ready to save`} />
              {!!c.saved && <Chip size="small" color="success" label={`${c.saved} saved as drafts`} />}
              {!!(c.gen_failed || c.save_failed) && (
                <Chip size="small" color="error" variant="outlined" label={`${(c.gen_failed || 0) + (c.save_failed || 0)} failed`} />
              )}
              {!!c.withoutImage && (
                <Tooltip title="These can be saved as drafts, but each needs a featured image before publishing. Add it in Review.">
                  <Chip size="small" color="warning" variant="outlined" icon={<ImageOutlined />} label={`${c.withoutImage} without image`} />
                </Tooltip>
              )}
            </Stack>
          )}
          {queue.pauseReason && (
            <Alert severity="warning" sx={{ mx: 2.5, mb: 1.5 }} onClose={() => queue.setPauseReason('')}>
              {queue.pauseReason} Rows not started are still pending; use Generate All when the limit resets.
            </Alert>
          )}
          {!!c.invalid && !run && (
            <Alert severity="error" variant="outlined" sx={{ mx: 2.5, mb: 1.5 }}>
              {c.invalid} row{c.invalid === 1 ? ' is' : 's are'} invalid and will not be generated. Edit {c.invalid === 1 ? 'it' : 'them'}, or use Remove Invalid.
              {c.valid ? ` The ${c.valid} valid row${c.valid === 1 ? '' : 's'} can be generated now.` : ''}
            </Alert>
          )}

          <BlogQueueTable
            rows={rows}
            running={!!run}
            imagesOn={queue.imagesOn}
            showImage
            showSourceRow
            onEdit={(r) => setEditing(r)}
            onRemove={remove}
            onGenerate={generateRow}
            onReview={(r) => setReviewId(r.id)}
            onOpenDraft={(r) => navigate(`/blogs/${r.savedBlog._id}/edit`)}
            emptyText="The plan is empty. Add a row, or upload a file."
          />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="subtitle1" color="text.primary" fontWeight={600} sx={{ mb: 1 }}>No plan yet</Typography>
          <Typography variant="body2">
            Download the template, list the month's blogs — one date and topic per row — and upload it.
            You will see every row checked before anything is generated.
          </Typography>
        </Paper>
      )}

      {editing && (
        <RowEditDialog
          row={editing.id ? editing : null}
          title={editing.id ? 'Edit row' : 'Add row'}
          categories={categories}
          imagesOn={queue.imagesOn}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
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

export default BulkUploadTab
