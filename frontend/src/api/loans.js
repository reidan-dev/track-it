import api from './client'

export const getLoans = () => api.get('/loans')
export const createLoan = (data) => api.post('/loans', data)
export const updateLoan = (id, data) => api.put(`/loans/${id}`, data)
export const deleteLoan = (id) => api.delete(`/loans/${id}`)
export const addLoanPayment = (id, data) => api.post(`/loans/${id}/payments`, data)
export const settleLoan = (id, finalAmount) =>
  api.patch(`/loans/${id}/settle`, null, { params: finalAmount ? { final_amount: finalAmount } : {} })
