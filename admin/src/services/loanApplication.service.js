import api from './api'

const BASE = '/loan-application'

// Read-only module. Applications arrive from the public website; the CMS
// reviews them and never authors or edits them here.

const getAllApplications = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getApplicationById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

export const loanApplicationService = {
  getAllApplications,
  getApplicationById
}
