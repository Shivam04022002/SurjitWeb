import api from './api'

const BASE = '/v1/nodal-officers'

// Plain JSON — a nodal officer carries no files.

const getAllOfficers = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getOfficerById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const createOfficer = async (data) => {
  const response = await api.post(BASE, data)
  return response.data
}

const updateOfficer = async (id, data) => {
  const response = await api.put(`${BASE}/${id}`, data)
  return response.data
}

const deleteOfficer = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishOfficer = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishOfficer = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const reorderOfficers = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const nodalOfficerService = {
  getAllOfficers,
  getOfficerById,
  createOfficer,
  updateOfficer,
  deleteOfficer,
  publishOfficer,
  unpublishOfficer,
  reorderOfficers
}
