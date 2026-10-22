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

// One document, streamed by the server from its own storage after checking
// the admin's Loan Applications access. Fetched through the API client (so an
// expired session is refreshed like any other request) and returned as a
// Blob; documents are never opened from a direct storage address.
const getDocument = async (id, type) => {
  const response = await api.get(`${BASE}/${id}/documents/${type}`, { responseType: 'blob' })
  return response.data
}

export const loanApplicationService = {
  getAllApplications,
  getApplicationById,
  getDocument,
  updateLoanApplicationStatus
}
