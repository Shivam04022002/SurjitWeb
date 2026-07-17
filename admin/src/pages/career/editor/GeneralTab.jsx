import { useState, useEffect } from 'react'
import {
  Box, TextField, Button, Grid, MenuItem,
  Select, FormControl, InputLabel, Typography
} from '@mui/material'
import { Save } from '@mui/icons-material'
import { careerService } from '../../../services/career.service'

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' }
]

const GeneralTab = ({ job, onSaved, showToast }) => {
  const [form, setForm] = useState({
    jobTitle: '',
    department: '',
    location: '',
    employmentType: '',
    experienceRequired: '',
    numberOfVacancies: 1,
    salary: '',
    shortDescription: '',
    fullDescription: '',
    applicationDeadline: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      jobTitle: job.jobTitle || '',
      department: job.department || '',
      location: job.location || '',
      employmentType: job.employmentType || '',
      experienceRequired: job.experienceRequired || '',
      numberOfVacancies: job.numberOfVacancies || 1,
      salary: job.salary || '',
      shortDescription: job.shortDescription || '',
      fullDescription: job.fullDescription || '',
      applicationDeadline: job.applicationDeadline
        ? new Date(job.applicationDeadline).toISOString().split('T')[0]
        : ''
    })
  }, [job])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.applicationDeadline) delete payload.applicationDeadline
      await careerService.updateJob(job._id, payload)
      showToast('General info saved successfully')
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
        <Typography variant="subtitle1" fontWeight={600}>General Information</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Job Title" name="jobTitle" value={form.jobTitle} onChange={handleChange} required />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Department" name="department" value={form.department} onChange={handleChange} required />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Location" name="location" value={form.location} onChange={handleChange} required />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Employment Type</InputLabel>
            <Select name="employmentType" value={form.employmentType} label="Employment Type" onChange={handleChange}>
              {EMPLOYMENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth label="Experience Required" name="experienceRequired" value={form.experienceRequired} onChange={handleChange} placeholder="e.g. 2-4 years" />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth label="Number of Vacancies" name="numberOfVacancies" type="number" value={form.numberOfVacancies} onChange={handleChange} inputProps={{ min: 1 }} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField fullWidth label="Application Deadline" name="applicationDeadline" type="date" value={form.applicationDeadline} onChange={handleChange} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Salary" name="salary" value={form.salary} onChange={handleChange} placeholder="e.g. ₹3-5 LPA" />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth multiline rows={3} label="Short Description" name="shortDescription"
            value={form.shortDescription} onChange={handleChange}
            inputProps={{ maxLength: 500 }}
            helperText={`${form.shortDescription.length}/500`}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth multiline rows={8} label="Full Description" name="fullDescription"
            value={form.fullDescription} onChange={handleChange}
            placeholder="Detailed job description..."
          />
        </Grid>
      </Grid>
    </Box>
  )
}

export default GeneralTab
