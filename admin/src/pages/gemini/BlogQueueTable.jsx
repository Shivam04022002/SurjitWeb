import {
  Box, Typography, Chip, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, IconButton, Tooltip,
  CircularProgress
} from '@mui/material'
import {
  Edit, DeleteOutline, AutoAwesome, RateReview, OpenInNew, Replay, ImageOutlined, CheckCircle, WarningAmber
} from '@mui/icons-material'
import { STATUS, PLAN_STAGE, BUSY } from './blogQueueModel'
import { formatDay } from './geminiBlogUtils'

const dayLabel = (row) => (row.date ? formatDay(row.date, { day: '2-digit', month: 'short', year: 'numeric' }) : row.input.date || '—')

// The image cell: what will happen, or what happened, to this row's image.
const ImageCell = ({ row, imagesOn }) => {
  if (row.image.status === 'generating') return <CircularProgress size={18} />
  if (row.form) {
    if (row.file && row.image.preview) {
      return <Box component="img" src={row.image.preview} alt="" sx={{ width: 52, height: 30, objectFit: 'cover', borderRadius: 0.5, display: 'block' }} />
    }
    if (row.file) return <Tooltip title="Uploaded image"><CheckCircle color="success" fontSize="small" /></Tooltip>
    if (row.image.status === 'failed') {
      return <Tooltip title={`${row.image.error} Upload one in Review.`}><WarningAmber color="warning" fontSize="small" /></Tooltip>
    }
    return <Tooltip title="No image — add one in Review"><ImageOutlined color="disabled" fontSize="small" /></Tooltip>
  }
  if (row.generateImage === null) return <Typography variant="caption" color="error">{row.input.generateImage || '—'}</Typography>
  if (!row.generateImage) return <Tooltip title="No image will be generated"><Typography variant="caption" color="text.secondary">No</Typography></Tooltip>
  return (
    <Tooltip title={imagesOn ? 'An image will be generated' : 'Image generation is turned off on the API page'}>
      <Typography variant="caption" color={imagesOn ? 'text.primary' : 'text.disabled'}>
        Yes{row.imageDefaulted ? ' (default)' : ''}
      </Typography>
    </Tooltip>
  )
}

// A compact list of plan rows and generated blogs. Actions depend on where a
// row is: plan rows are edited or generated; generated rows are reviewed,
// saved or regenerated; saved rows link to the draft.
const BlogQueueTable = ({
  rows, running, imagesOn, showImage = false, showSourceRow = false,
  onEdit, onRemove, onGenerate, onReview, onOpenDraft, emptyText
}) => (
  <TableContainer sx={{ maxHeight: 560 }}>
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 44 }}>{showSourceRow ? 'Row' : '#'}</TableCell>
          <TableCell sx={{ width: 120 }}>Date</TableCell>
          <TableCell>Topic</TableCell>
          <TableCell sx={{ width: 160 }}>Category</TableCell>
          {showImage && <TableCell sx={{ width: 72 }}>Image</TableCell>}
          <TableCell sx={{ width: 220 }}>Status</TableCell>
          <TableCell sx={{ width: 132 }} align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => {
          const st = STATUS[r.status]
          const plan = PLAN_STAGE.includes(r.status)
          const busy = BUSY.includes(r.status)
          const locked = running || busy
          const messages = r.status === 'invalid' ? r.errors.map((e) => e.message) : r.error ? [r.error] : []
          const notes = messages.length ? [] : [...(plan ? r.warnings : []), ...(r.status === 'generated' ? r.genWarnings : [])]
          return (
            <TableRow key={r.id} hover sx={{ verticalAlign: 'top', bgcolor: r.status === 'invalid' ? 'rgba(211, 47, 47, 0.04)' : undefined }}>
              <TableCell sx={{ color: 'text.secondary' }}>
                {/* In a plan from Excel, the number is the sheet's row; rows added here are marked New. */}
                {showSourceRow ? (r.sourceRow || <Typography variant="caption" color="primary">New</Typography>) : i + 1}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="body2" color={r.errors.some((e) => e.field === 'date') ? 'error' : 'text.primary'}>{dayLabel(r)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: r.form ? 600 : 400 }}>
                  {r.form ? r.form.title : (r.input.topic || <em>No topic</em>)}
                </Typography>
                {r.form && r.form.title !== r.topic && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Topic: {r.topic}</Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color={r.errors.some((e) => e.field === 'category') ? 'error' : r.category ? 'text.primary' : 'text.secondary'}>
                  {r.category?.name || r.input.category || 'Gemini chooses'}
                </Typography>
              </TableCell>
              {showImage && <TableCell><ImageCell row={r} imagesOn={imagesOn} /></TableCell>}
              <TableCell>
                <Chip
                  size="small" label={st.label} color={st.color} variant={st.variant || 'filled'}
                  icon={busy && r.status !== 'queued' ? <CircularProgress size={12} color="inherit" /> : undefined}
                />
                {messages.map((m) => (
                  <Typography key={m} variant="caption" color="error" sx={{ display: 'block', mt: 0.5, lineHeight: 1.35 }}>{m}</Typography>
                ))}
                {notes.slice(0, 1).map((m) => (
                  <Typography key={m} variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, lineHeight: 1.35 }}>{m}</Typography>
                ))}
                {!showImage && r.form && r.image.status === 'failed' && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>Image failed — upload one in Review</Typography>
                )}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                {r.status === 'saved' && r.savedBlog ? (
                  <Tooltip title="Open draft in the blog editor">
                    <IconButton size="small" onClick={() => onOpenDraft(r)}><OpenInNew fontSize="small" /></IconButton>
                  </Tooltip>
                ) : (
                  <>
                    {r.form ? (
                      <Tooltip title="Review, edit and save">
                        <span><IconButton size="small" color="primary" onClick={() => onReview(r)} disabled={locked}><RateReview fontSize="small" /></IconButton></span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Edit">
                        <span><IconButton size="small" onClick={() => onEdit(r)} disabled={locked}><Edit fontSize="small" /></IconButton></span>
                      </Tooltip>
                    )}
                    <Tooltip title={r.form ? 'Regenerate this blog' : r.status === 'gen_failed' ? 'Retry' : 'Generate'}>
                      <span>
                        <IconButton size="small" onClick={() => onGenerate(r)} disabled={locked || r.status === 'invalid'}>
                          {r.status === 'gen_failed' || r.form ? <Replay fontSize="small" /> : <AutoAwesome fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <span><IconButton size="small" onClick={() => onRemove(r)} disabled={locked}><DeleteOutline fontSize="small" /></IconButton></span>
                    </Tooltip>
                  </>
                )}
              </TableCell>
            </TableRow>
          )
        })}
        {!rows.length && (
          <TableRow>
            <TableCell colSpan={showImage ? 7 : 6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </TableContainer>
)

export default BlogQueueTable
