import { create } from 'zustand'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'

export const useAuth = create((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  login: async (email, password) => {
    const { data } = await apiLogin(email, password)
    localStorage.setItem('access_token', data.access_token)
    set({ isAuthenticated: true })
  },
  logout: async () => {
    try { await apiLogout() } catch {}
    localStorage.removeItem('access_token')
    set({ isAuthenticated: false })
  },
}))
