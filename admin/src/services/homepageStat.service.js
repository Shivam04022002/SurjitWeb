import api from './api'

const BASE = '/v1/homepage-stats'

// Plain JSON — a statistic carries no files.

const getAllStats = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getStatById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const createStat = async (data) => {
  const response = await api.post(BASE, data)
  return response.data
}

const updateStat = async (id, data) => {
  const response = await api.put(`${BASE}/${id}`, data)
  return response.data
}

const deleteStat = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishStat = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishStat = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const reorderStats = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const homepageStatService = {
  getAllStats,
  getStatById,
  createStat,
  updateStat,
  deleteStat,
  publishStat,
  unpublishStat,
  reorderStats
}
