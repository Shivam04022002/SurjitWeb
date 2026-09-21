import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem,
  FormControlLabel, Switch, Alert
} from '@mui/material'

// Edits a planned row: date, topic, category and whether to generate an
// image. The server re-validates the whole list afterwards (duplicates,
// categories, date window), so this only checks what can be seen locally.
//
// For a row imported from Excel with an invalid value, the value as it was
// in the file is shown next to the field so nothing is changed silently.
const RowEditDialog = ({ row, categories, imagesOn, onSave, onClose, title = 'Edit blog' }) => {
  const isNew = !row?.id
  const [date, setDate] = useState(row?.date || '')
  const [topic, setTopic] = useState(row?.input?.topic || row?.topic || '')
  const [category, setCategory] = useState(row?.category?._id || '')
  const [generateImage, setGenerateImage] = useState(row?.generateImage ?? true)
  const [errors, setErrors] = useState({})

  const fieldError = (field) => row?.errors?.find((e) => e.field === field)?.message
  const fromFile = (field) => (row?.source === 'excel' && fieldError(field) ? row.input[field] : '')
  const active = categories.filter((c) => c.isActive)

  const submit = () => {
    const e = {}
    if (!date) e.date = 'Choose a date'
    if (topic.trim().length < 3) e.topic = 'Enter a topic of at least 3 characters'
    setErrors(e)
    if (Object.keys(e).length) return
    onSave({ date, topic: topic.trim(), category, generateImage })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}{row?.sourceRow ? ` — Excel row ${row.sourceRow}` : ''}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {!isNew && row.errors?.length > 0 && (
            <Alert severity="error">{row.errors.map((e) => <div key={e.message}>{e.message}</div>)}</Alert>
          )}
          <TextField
            label="Create Date" type="date" required value={date}
            onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: '' })) }}
            error={!!errors.date}
            helperText={errors.date || (fromFile('date') ? `In the file: "${fromFile('date')}"` : 'The blog\'s create date (India time)')}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Blog Name / Topic" required value={topic} multiline maxRows={3}
            onChange={(e) => { setTopic(e.target.value); setErrors((x) => ({ ...x, topic: '' })) }}
            error={!!errors.topic}
            helperText={errors.topic || `${topic.trim().length}/200`}
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}
            helperText={fromFile('category') ? `In the file: "${fromFile('category')}" — not an active category` : 'Optional. Leave for Gemini to choose from your categories.'}
            error={!!fromFile('category') && !category}
          >
            <MenuItem value=""><em>Let Gemini choose</em></MenuItem>
            {active.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={<Switch checked={!!generateImage} onChange={(e) => setGenerateImage(e.target.checked)} />}
            label={imagesOn ? 'Generate featured image' : 'Generate featured image (turned off on the API page)'}
          />
          {fromFile('generateImage') && (
            <Alert severity="info">In the file: "{fromFile('generateImage')}". Choose Yes or No above.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>{isNew ? 'Add Row' : 'Save Changes'}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default RowEditDialog
