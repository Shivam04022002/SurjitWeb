import api from './api'

const BASE = '/v1/reports'

const getAllReports = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getReportById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

// Multipart because the PDF and optional thumbnail ride along with the fields.
const createReport = async (formData) => {
  const response = await api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateReport = async (id, formData) => {
  const response = await api.put(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteReport = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishReport = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishReport = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const reorderReports = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const reportService = {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  publishReport,
  unpublishReport,
  reorderReports
}
