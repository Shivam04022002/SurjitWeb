import api from './api'

const BASE = '/loan-application'

// Applications arrive from the public website; the CMS reviews them and moves
// them between statuses, but never authors or edits applicant data here.

const getAllApplications = async (params = {}) => {
  const response = await api.get(BASE, { params })
  return response.data
}

const getApplicationById = async (id) => {
  const response = await api.get(`${BASE}/${id}`)
  return response.data
}

// Status decision. Only the status value is sent; the server ignores anything
// else, and applicant fields are not editable from the CMS.
const updateLoanApplicationStatus = async (id, status) => {
  const response = await api.patch(`${BASE}/${id}/status`, { status })
  return response.data
}

export const loanApplicationService = {
  getAllApplications,
  getApplicationById,
  updateLoanApplicationStatus
}
