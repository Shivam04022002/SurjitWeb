import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Container, Typography, Tabs, Tab, Paper, Button,
  CircularProgress, Breadcrumbs, Link, Chip, Stack
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { careerService } from '../../../services/career.service'
import Toast from '../../../components/Toast'
import GeneralTab from './GeneralTab'
import StringListTab from './StringListTab'
import SeoTab from './SeoTab'

const TAB_LABELS = ['General', 'Responsibilities', 'Qualifications', 'Skills', 'SEO']

const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  internship: 'Internship',
  contract: 'Contract'
}

const JobEditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message, severity = 'success') => {
    setToast({ open: true, message, severity })
  }, [])

  const fetchJob = useCallback(async () => {
    try {
      const res = await careerService.getJobById(id)
      setJob(res.data.job)
    } catch {
      showToast('Failed to load job', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => { fetchJob() }, [fetchJob])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!job) {
    return (
      <Container maxWidth="xl" disableGutters>
        <Typography color="error">Job opening not found.</Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/career/jobs')} sx={{ mt: 2 }}>
          Back to Jobs
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link
            component="button" variant="body2" underline="hover" color="inherit"
            onClick={() => navigate('/career/jobs')}
          >
            Job Openings
          </Link>
          <Typography variant="body2" color="text.primary">{job.jobTitle}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/career/jobs')} variant="outlined" size="small">
              Back
            </Button>
            <Box>
              <Typography variant="h5" fontWeight={700}>{job.jobTitle}</Typography>
              <Typography variant="caption" color="text.secondary">
                {job.department} &nbsp;·&nbsp; {job.location} &nbsp;·&nbsp; {EMPLOYMENT_TYPE_LABELS[job.employmentType] || job.employmentType}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              label={job.isPublished ? 'Published' : 'Draft'}
              color={job.isPublished ? 'primary' : 'default'}
              size="small"
            />
            <Chip
              label={job.isActive ? 'Active' : 'Inactive'}
              color={job.isActive ? 'success' : 'default'}
              size="small"
            />
          </Stack>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            '& .MuiTab-root': { minWidth: 100, fontWeight: 500 }
          }}
        >
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <GeneralTab job={job} onSaved={fetchJob} showToast={showToast} />
          )}
          {activeTab === 1 && (
            <StringListTab
              jobId={id}
              field="responsibilities"
              label="Responsibility"
              items={job.responsibilities || []}
              onSaved={fetchJob}
              showToast={showToast}
            />
          )}
          {activeTab === 2 && (
            <StringListTab
              jobId={id}
              field="qualifications"
              label="Qualification"
              items={job.qualifications || []}
              onSaved={fetchJob}
              showToast={showToast}
            />
          )}
          {activeTab === 3 && (
            <StringListTab
              jobId={id}
              field="skillsRequired"
              label="Skill"
              items={job.skillsRequired || []}
              onSaved={fetchJob}
              showToast={showToast}
            />
          )}
          {activeTab === 4 && (
            <SeoTab job={job} onSaved={fetchJob} showToast={showToast} />
          )}
        </Box>
      </Paper>

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </Container>
  )
}

export default JobEditorPage
