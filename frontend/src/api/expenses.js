import api from './client'

export const getExpenses = (params) => api.get('/expenses', { params })
export const searchExpenses = (params) => api.get('/expenses/search', { params })
export const createExpense = (data) => api.post('/expenses', data)
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data)
export const deleteExpense = (id) => api.delete(`/expenses/${id}`)
export const getExpenseReceipt = (id) => api.get(`/expenses/${id}/receipt`)
export const settleExpenseParticipant = (id, personId, month, year, period = null) =>
  api.post(`/expenses/${id}/settle/${personId}/${month}/${year}`, null, { params: period != null ? { period } : {} })
export const unsettleExpenseParticipant = (id, personId, month, year, period = null) =>
  api.delete(`/expenses/${id}/settle/${personId}/${month}/${year}`, { params: period != null ? { period } : {} })
