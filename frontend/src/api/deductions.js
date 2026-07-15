import api from './client'

export const getDeductions = (month, year) => api.get('/deductions', { params: { month, year } })
export const createDeduction = (data) => api.post('/deductions', data)
export const deleteDeduction = (id) => api.delete(`/deductions/${id}`)
