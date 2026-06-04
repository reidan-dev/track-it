import api from './client'

export const getIncome = (params) => api.get('/income', { params })
export const createIncome = (data) => api.post('/income', data)
export const updateIncome = (id, data) => api.put(`/income/${id}`, data)
export const deleteIncome = (id) => api.delete(`/income/${id}`)
