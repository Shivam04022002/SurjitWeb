import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

let isRefreshing = false
let refreshSubscribers = []

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback)
}

const onTokenRefreshed = () => {
  refreshSubscribers.forEach((callback) => callback())
  refreshSubscribers = []
}

const refreshAccessToken = async () => {
  try {
    await api.post('/v1/auth/refresh-token')
    return true
  } catch (error) {
    return false
  }
}

const isRefreshRequest = (config) => {
  return config.url?.includes('/v1/auth/refresh-token')
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest(originalRequest)
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshed = await refreshAccessToken()
      isRefreshing = false

      if (refreshed) {
        onTokenRefreshed()
        return api(originalRequest)
      }

      // Only hard-navigate from an authenticated page. On /login the profile
      // check 401s by design, and redirecting to the current URL reloads the
      // document, remounts AuthProvider, and re-fires the same failing check --
      // an endless reload loop. ProtectedRoute already handles the routing.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
