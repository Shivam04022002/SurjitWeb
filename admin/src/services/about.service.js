import api from './api'

// ── Company ──────────────────────────────────────────────────────────────────

const getCompanyInfo = async () => {
  const response = await api.get('/v1/about/company')
  return response.data
}

const updateCompanyInfo = async (formData) => {
  const response = await api.put('/v1/about/company', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

// ── Directors ─────────────────────────────────────────────────────────────────

const getAllDirectors = async () => {
  const response = await api.get('/v1/about/directors')
  return response.data
}

const createDirector = async (formData) => {
  const response = await api.post('/v1/about/directors', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateDirector = async (id, formData) => {
  const response = await api.put(`/v1/about/directors/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteDirector = async (id) => {
  const response = await api.delete(`/v1/about/directors/${id}`)
  return response.data
}

const toggleDirectorStatus = async (id) => {
  const response = await api.patch(`/v1/about/directors/${id}/status`)
  return response.data
}

const reorderDirectors = async (ids) => {
  const response = await api.patch('/v1/about/directors/reorder', { ids })
  return response.data
}

const transferDirector = async (id, targetTeam) => {
  const response = await api.post(`/v1/about/directors/${id}/transfer`, { targetTeam })
  return response.data
}

// ── Leadership ────────────────────────────────────────────────────────────────

const getAllLeadershipMembers = async () => {
  const response = await api.get('/v1/about/leadership')
  return response.data
}

const createLeadershipMember = async (formData) => {
  const response = await api.post('/v1/about/leadership', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const updateLeadershipMember = async (id, formData) => {
  const response = await api.put(`/v1/about/leadership/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

const deleteLeadershipMember = async (id) => {
  const response = await api.delete(`/v1/about/leadership/${id}`)
  return response.data
}

const toggleLeadershipStatus = async (id) => {
  const response = await api.patch(`/v1/about/leadership/${id}/status`)
  return response.data
}

const reorderLeadershipMembers = async (ids) => {
  const response = await api.patch('/v1/about/leadership/reorder', { ids })
  return response.data
}

const transferLeadershipMember = async (id, targetTeam) => {
  const response = await api.post(`/v1/about/leadership/${id}/transfer`, { targetTeam })
  return response.data
}

export const aboutService = {
  getCompanyInfo,
  updateCompanyInfo,
  getAllDirectors,
  createDirector,
  updateDirector,
  deleteDirector,
  toggleDirectorStatus,
  reorderDirectors,
  transferDirector,
  getAllLeadershipMembers,
  createLeadershipMember,
  updateLeadershipMember,
  deleteLeadershipMember,
  toggleLeadershipStatus,
  reorderLeadershipMembers,
  transferLeadershipMember
}
