import api from './api'

const BASE = '/v1/linkedin'

// Every LinkedIn call goes through the CMS backend. The browser never sees a
// LinkedIn token or the app's client secret: it only asks the server to start
// the sign-in (and is sent to LinkedIn), and to publish a blog by ID with a
// caption. The page, the link and the image are chosen by the server.

// API Settings → LinkedIn app settings. The client secret is sent only when
// replaced, and never comes back: the response says only whether one is set.
const getConfig = async () => {
  const response = await api.get(`${BASE}/config`)
  return response.data
}

const saveConfig = async (data) => {
  const response = await api.put(`${BASE}/config`, data)
  return response.data
}

// Readiness when nothing is connected; a live read-only check when it is.
const testConfig = async () => {
  const response = await api.post(`${BASE}/config/test`)
  return response.data
}

const getConnection = async () => {
  const response = await api.get(`${BASE}/connection`)
  return response.data
}

// Returns { authorizationUrl }; the caller sends the browser there.
const startAuthorization = async () => {
  const response = await api.post(`${BASE}/connection/authorize`)
  return response.data
}

const disconnect = async () => {
  const response = await api.delete(`${BASE}/connection`)
  return response.data
}

const getPreview = async (blogId) => {
  const response = await api.get(`${BASE}/blogs/${blogId}/preview`)
  return response.data
}

const getPublication = async (blogId) => {
  const response = await api.get(`${BASE}/blogs/${blogId}/publication`)
  return response.data
}

const publish = async (blogId, caption) => {
  const response = await api.post(`${BASE}/blogs/${blogId}/publish`, { caption, confirm: true })
  return response.data
}

// After an uncertain outcome: 'not_published', or 'published' with the URN.
const resolve = async (blogId, outcome, postUrn) => {
  const response = await api.post(`${BASE}/blogs/${blogId}/resolve`, { outcome, postUrn })
  return response.data
}

export const linkedinService = {
  getConfig, saveConfig, testConfig,
  getConnection, startAuthorization, disconnect,
  getPreview, getPublication, publish, resolve
}
