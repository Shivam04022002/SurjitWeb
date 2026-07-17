import { Box, Grid, TextField, Button, CircularProgress } from '@mui/material'
import { Save } from '@mui/icons-material'

const AddressTab = ({ form, onChange, onSave, saving }) => {
  return (
    <Box sx={{ maxWidth: 760 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            label="Office Address"
            name="officeAddress"
            value={form.officeAddress}
            onChange={onChange}
            fullWidth
            multiline
            rows={3}
            size="small"
            inputProps={{ maxLength: 500 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="City"
            name="city"
            value={form.city}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="State"
            name="state"
            value={form.state}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Country"
            name="country"
            value={form.country}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="PIN Code"
            name="pinCode"
            value={form.pinCode}
            onChange={onChange}
            fullWidth
            size="small"
            inputProps={{ maxLength: 10 }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Google Maps URL"
            name="googleMapsUrl"
            value={form.googleMapsUrl}
            onChange={onChange}
            fullWidth
            size="small"
            placeholder="https://maps.google.com/..."
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Address'}
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}

export default AddressTab
