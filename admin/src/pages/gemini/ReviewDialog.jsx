import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Alert, Typography, CircularProgress
} from '@mui/material'
import { Save, DeleteOutline } from '@mui/icons-material'
import GeneratedBlogEditor from './GeneratedBlogEditor'
import { validateBlogForm } from './geminiBlogUtils'

// Review one generated blog: every field editable, then Save as Draft or
// Delete. Edits are kept with the row, so closing without saving loses
// nothing; Save All as Drafts saves them later.
const ReviewDialog = ({ queue, row, categories, onDelete, onClose, showToast }) => {
  const [errors, setErrors] = useState({})
  if (!row) return null
  const saving = row.status === 'saving'
  const imagesOn = queue.imagesOn

  const onFormChange = (u) => queue.patch(row.id, (r) => ({ form: typeof u === 'function' ? u(r.form) : u }))

  const saveNow = async () => {
    const errs = validateBlogForm(row.form, row.date)
    setErrors(errs)
    if (Object.keys(errs).length) {
      showToast('Please fix the highlighted fields', 'error')
      return
    }
    const saved = await queue.save([row.id])
    if (saved) onClose()
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xl" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        Review generated blog
        <Chip size="small" label="Draft" />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          Saved as a draft only. Publish it later from All Blogs.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {row.error && <Alert severity="error" sx={{ mb: 2 }}>{row.error}</Alert>}
        {row.genWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>{row.genWarnings.map((w) => <div key={w}>{w}</div>)}</Alert>
        )}
        <GeneratedBlogEditor
          key={`${row.id}-${row.formVersion}`}
          form={row.form}
          onFormChange={onFormChange}
          errors={errors}
          onClearError={(name) => setErrors((e) => ({ ...e, [name]: '' }))}
          categories={categories}
          createDate={row.date || ''}
          onCreateDateChange={(v) => queue.patch(row.id, (r) => ({ date: v, input: { ...r.input, date: v } }))}
          image={row.image}
          hasImageFile={!!row.file}
          imageEnabled={imagesOn}
          // An uploaded file gets a local preview so the list and a reopened
          // review show it; it is still sent only when the draft is saved.
          onImageFile={(file) => queue.patch(row.id, (r) => ({
            file,
            image: { ...r.image, preview: file ? URL.createObjectURL(file) : '', status: file ? 'uploaded' : 'idle', error: '' }
          }))}
          onGenerateImage={() => queue.generateImage(row.id)}
          disabled={saving}
          showToast={showToast}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="error" startIcon={<DeleteOutline />} onClick={() => onDelete(row)} disabled={saving} sx={{ mr: 'auto' }}>
          Delete
        </Button>
        <Button onClick={onClose} disabled={saving}>Close</Button>
        <Button
          variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={saveNow} disabled={saving || row.image.status === 'generating' || !!queue.run}
        >
          {saving ? 'Saving draft…' : 'Save as Draft'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReviewDialog
