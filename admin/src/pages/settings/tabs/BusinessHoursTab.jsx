import { Box, Grid, TextField, Button, CircularProgress, Typography, Paper } from '@mui/material'
import { Save, Schedule } from '@mui/icons-material'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

const BusinessHoursTab = ({ form, onChange, onSave, saving }) => {
  const handleDayChange = (e) => {
    const { name, value } = e.target
    onChange({ target: { name: `businessHours.${name}`, value } })
  }

  const hours = form.businessHours || {}

  return (
    <Box sx={{ maxWidth: 680 }}>
      <Grid container spacing={2}>
        {DAYS.map(({ key, label }) => (
          <Grid item xs={12} sm={6} key={key}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600}>{label}</Typography>
              </Box>
              <TextField
                name={key}
                value={hours[key] || ''}
                onChange={handleDayChange}
                fullWidth
                size="small"
                placeholder="e.g. 9:00 AM – 6:00 PM or Closed"
                inputProps={{ maxLength: 100 }}
              />
            </Paper>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Business Hours'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default BusinessHoursTab
