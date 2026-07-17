import api from './api'

const login = async (credentials) => {
  const response = await api.post('/v1/auth/login', credentials)
  return response.data
}

const logout = async () => {
  const response = await api.post('/v1/auth/logout')
  return response.data
}

const getProfile = async () => {
  const response = await api.get('/v1/auth/profile')
  return response.data
}

const changePassword = async (data) => {
  const response = await api.post('/v1/auth/change-password', data)
  return response.data
}

export const authService = {
  login,
  logout,
  getProfile,
  changePassword
}
