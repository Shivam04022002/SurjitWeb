import api from './api'

const BASE = '/v1/careers'

// ── Career Settings ────────────────────────────────────────────────────────────

const getSettings = async () => {
  const response = await api.get(`${BASE}/settings`)
  return response.data
}

const updateSettings = async (formData) => {
  const response = await api.put(`${BASE}/settings`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

// ── Job Openings ───────────────────────────────────────────────────────────────

const getAllJobs = async (params = {}) => {
  const response = await api.get(`${BASE}/jobs`, { params })
  return response.data
}

const getJobById = async (id) => {
  const response = await api.get(`${BASE}/jobs/${id}`)
  return response.data
}

const createJob = async (data) => {
  const response = await api.post(`${BASE}/jobs`, data)
  return response.data
}

const updateJob = async (id, data) => {
  const response = await api.put(`${BASE}/jobs/${id}`, data)
  return response.data
}

const deleteJob = async (id) => {
  const response = await api.delete(`${BASE}/jobs/${id}`)
  return response.data
}

const toggleJobStatus = async (id) => {
  const response = await api.patch(`${BASE}/jobs/${id}/status`)
  return response.data
}

const toggleJobPublish = async (id) => {
  const response = await api.patch(`${BASE}/jobs/${id}/publish`)
  return response.data
}

const reorderJobs = async (ids) => {
  const response = await api.patch(`${BASE}/jobs/reorder`, { ids })
  return response.data
}

const duplicateJob = async (id) => {
  const response = await api.post(`${BASE}/jobs/${id}/duplicate`)
  return response.data
}

// ── Applications ───────────────────────────────────────────────────────────────

const getAllApplications = async (params = {}) => {
  const response = await api.get(`${BASE}/applications`, { params })
  return response.data
}

const getApplicationById = async (id) => {
  const response = await api.get(`${BASE}/applications/${id}`)
  return response.data
}

const updateApplicationStatus = async (id, status) => {
  const response = await api.patch(`${BASE}/applications/${id}/status`, { status })
  return response.data
}

const deleteApplication = async (id) => {
  const response = await api.delete(`${BASE}/applications/${id}`)
  return response.data
}

const getExportUrl = () => {
  return `${api.defaults.baseURL}${BASE}/applications/export`
}

export const careerService = {
  getSettings,
  updateSettings,
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  toggleJobPublish,
  reorderJobs,
  duplicateJob,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getExportUrl
}
