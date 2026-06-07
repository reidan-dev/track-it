import { create } from 'zustand'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'

export const useAuth = create((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  login: async (email, password) => {
    const { data } = await apiLogin(email, password)
    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
    set({ isAuthenticated: true })
  },
  logout: async () => {
    try { await apiLogout() } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('trackit-query-cache')  // drop persisted data cache
    set({ isAuthenticated: false })
  },
}))
