import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Dedupe concurrent refreshes: parallel 401s share one in-flight refresh.
let refreshPromise = null

function doRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_URL}/auth/refresh`,
        { refresh_token: localStorage.getItem('refresh_token') },
        { withCredentials: true }
      )
      .then(({ data }) => {
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
        return data.access_token
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      try {
        const token = await doRefresh()
        err.config.headers.Authorization = `Bearer ${token}`
        return api(err.config)
      } catch {
        // The refresh token itself is invalid/expired — the only path to logout
        // besides the user tapping Logout.
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
