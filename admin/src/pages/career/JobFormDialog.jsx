import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, MenuItem, Select,
  FormControl, InputLabel, FormHelperText
} from '@mui/material'

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' }
]

const defaultForm = {
  jobTitle: '',
  department: '',
  location: '',
  employmentType: '',
  experienceRequired: '',
  numberOfVacancies: 1,
  salary: '',
  shortDescription: '',
  applicationDeadline: ''
}

const JobFormDialog = ({ open, job, onSave, onClose, saving }) => {
  const [form, setForm] = useState(defaultForm)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (job) {
      setForm({
        jobTitle: job.jobTitle || '',
        department: job.department || '',
        location: job.location || '',
        employmentType: job.employmentType || '',
        experienceRequired: job.experienceRequired || '',
        numberOfVacancies: job.numberOfVacancies || 1,
        salary: job.salary || '',
        shortDescription: job.shortDescription || '',
        applicationDeadline: job.applicationDeadline
          ? new Date(job.applicationDeadline).toISOString().split('T')[0]
          : ''
      })
    } else {
      setForm(defaultForm)
    }
    setErrors({})
  }, [job, open])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.jobTitle.trim()) errs.jobTitle = 'Job title is required'
    if (!form.department.trim()) errs.department = 'Department is required'
    if (!form.location.trim()) errs.location = 'Location is required'
    if (!form.employmentType) errs.employmentType = 'Employment type is required'
    return errs
  }

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const payload = { ...form }
    if (!payload.applicationDeadline) delete payload.applicationDeadline
    onSave(payload)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{job ? 'Edit Job Opening' : 'Create Job Opening'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Job Title" name="jobTitle"
              value={form.jobTitle} onChange={handleChange}
              error={!!errors.jobTitle} helperText={errors.jobTitle}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Department" name="department"
              value={form.department} onChange={handleChange}
              error={!!errors.department} helperText={errors.department}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Location" name="location"
              value={form.location} onChange={handleChange}
              error={!!errors.location} helperText={errors.location}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!errors.employmentType} required>
              <InputLabel>Employment Type</InputLabel>
              <Select name="employmentType" value={form.employmentType} label="Employment Type" onChange={handleChange}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
              {errors.employmentType && <FormHelperText>{errors.employmentType}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Experience Required" name="experienceRequired"
              value={form.experienceRequired} onChange={handleChange}
              placeholder="e.g. 2-4 years"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth label="Number of Vacancies" name="numberOfVacancies" type="number"
              value={form.numberOfVacancies} onChange={handleChange}
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth label="Application Deadline" name="applicationDeadline" type="date"
              value={form.applicationDeadline} onChange={handleChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Salary" name="salary"
              value={form.salary} onChange={handleChange}
              placeholder="e.g. ₹3-5 LPA"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth multiline rows={3} label="Short Description" name="shortDescription"
              value={form.shortDescription} onChange={handleChange}
              inputProps={{ maxLength: 500 }}
              helperText={`${form.shortDescription.length}/500`}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : job ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default JobFormDialog
