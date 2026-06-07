import api from './client'

export const getSettings = () => api.get('/settings')
export const updateSettings = (data) => api.put('/settings', data)
export const testTelegram = () => api.post('/settings/telegram/test')
export const connectTelegram = () => api.post('/settings/telegram/connect')
export const disconnectTelegram = () => api.post('/settings/telegram/disconnect')
export const testReminder = (period) => api.post('/settings/reminders/test', null, { params: { period } })
export const exportModule = (module, params) =>
  api.get(`/export/${module}`, { params, responseType: 'blob' })
