import api from './api'

const BASE = '/v1/legal-pages'

const getAllPages = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getPageById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

// Multipart because an optional PDF rides along with the fields.
const createPage = async (formData) => {
  const response = await api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updatePage = async (id, formData) => {
  const response = await api.put(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deletePage = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishPage = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishPage = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const reorderPages = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const legalPageService = {
  getAllPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  publishPage,
  unpublishPage,
  reorderPages
}
