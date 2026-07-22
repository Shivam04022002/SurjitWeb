import api from './api'

const BASE = '/v1/branches'

// Plain JSON — a branch carries no files.

const getAllBranches = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getBranchById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

const createBranch = async (data) => {
  const response = await api.post(BASE, data)
  return response.data
}

const updateBranch = async (id, data) => {
  const response = await api.put(`${BASE}/${id}`, data)
  return response.data
}

const deleteBranch = async (id) => {
  const response = await api.delete(`${BASE}/${id}`)
  return response.data
}

const publishBranch = async (id) => {
  const response = await api.patch(`${BASE}/${id}/publish`)
  return response.data
}

const unpublishBranch = async (id) => {
  const response = await api.patch(`${BASE}/${id}/unpublish`)
  return response.data
}

const reorderBranches = async (ids) => {
  const response = await api.patch(`${BASE}/reorder`, { ids })
  return response.data
}

export const branchService = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  publishBranch,
  unpublishBranch,
  reorderBranches
}
