import api from './api'

const BASE = '/v1/email-settings'

// Every email call goes through the CMS backend. The browser never holds the
// Microsoft client secret after Save: it is sent once, and the server only
// ever returns its last four characters.

const getSettings = async () => {
  const response = await api.get(BASE)
  return response.data
}

// A payload without clientSecret keeps the secret already stored.
const saveSettings = async (data) => {
  const response = await api.put(BASE, data)
  return response.data
}

// The Email API card on the API page: credentials and sender only. Without
// clientSecret, the stored secret is kept.
const saveProvider = async (data) => {
  const response = await api.put(`${BASE}/provider`, data)
  return response.data
}

// Email Settings: recipients, the products each additional recipient is
// emailed about, and the notification preference.
const saveRecipients = async (data) => {
  const response = await api.put(`${BASE}/recipients`, data)
  return response.data
}

// Both tests use the saved configuration, never what is typed on the page.
const testConnection = async () => {
  const response = await api.post(`${BASE}/test-connection`)
  return response.data
}

const sendTestEmail = async (recipient) => {
  const response = await api.post(`${BASE}/test-email`, { recipient })
  return response.data
}

// Email Delivery Log: one page of loan-application email records.
const getNotifications = async (params) => {
  const response = await api.get(`${BASE}/notifications`, { params })
  return response.data
}

// Only a retry the server already scheduled can be brought forward; the server
// refuses anything else.
// One record in full. Applicant details and the regenerated email preview
// come back only when the admin also holds Loan Applications view.
const getNotification = async (id) => {
  const response = await api.get(`${BASE}/notifications/${encodeURIComponent(id)}`)
  return response.data
}

const retryNotification = async (id) => {
  const response = await api.post(`${BASE}/notifications/${encodeURIComponent(id)}/retry`)
  return response.data
}

export const emailSettingsService = {
  getSettings,
  saveSettings,
  saveProvider,
  saveRecipients,
  testConnection,
  sendTestEmail,
  getNotifications,
  getNotification,
  retryNotification
}
