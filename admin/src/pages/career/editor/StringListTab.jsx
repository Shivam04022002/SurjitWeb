import { useState } from 'react'
import {
  Box, TextField, Button, Typography, List,
  ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Paper, Divider
} from '@mui/material'
import { Add, Delete, Save } from '@mui/icons-material'
import { careerService } from '../../../services/career.service'

const StringListTab = ({ jobId, field, label, items: initialItems, onSaved, showToast }) => {
  const [items, setItems] = useState(initialItems || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = () => {
    const trimmed = newItem.trim()
    if (!trimmed) return
    setItems((prev) => [...prev, trimmed])
    setNewItem('')
  }

  const handleRemove = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await careerService.updateJob(jobId, { [field]: items })
      showToast(`${label}s saved successfully`)
      onSaved()
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600}>{label}s</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          label={`Add ${label}`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type and press Enter or click Add`}
        />
        <Button variant="outlined" startIcon={<Add />} onClick={handleAdd} disabled={!newItem.trim()}>
          Add
        </Button>
      </Box>

      {items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No {label.toLowerCase()}s added yet.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <List dense disablePadding>
            {items.map((item, index) => (
              <Box key={index}>
                <ListItem sx={{ pr: 6 }}>
                  <ListItemText
                    primary={item}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" color="error" onClick={() => handleRemove(index)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < items.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}

export default StringListTab
