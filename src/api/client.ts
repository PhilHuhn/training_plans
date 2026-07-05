import axios from 'axios'

const isBrowser = typeof window !== 'undefined'

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  if (isBrowser) {
    const token = window.localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && isBrowser) {
      window.localStorage.removeItem('access_token')
      window.localStorage.removeItem('auth-storage')
      // Belt + braces: the 401 response itself already clears the auth cookie
      // (server-side, via Set-Cookie), but if an error path skips that we
      // explicitly hit /api/auth/logout to make sure the cookie is gone before
      // redirecting. Without this, /login would bounce back to the protected
      // route because middleware would still see the stale cookie.
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      } catch {
        // network errors are fine — server already cleared via Set-Cookie
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
