import api from './client'

export const getSettings = () => api.get('/settings')
export const updateSettings = (data) => api.put('/settings', data)
export const testTelegram = () => api.post('/settings/telegram/test')
export const exportModule = (module, params) =>
  api.get(`/export/${module}`, { params, responseType: 'blob' })
