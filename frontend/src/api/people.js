import api from './client'

export const getPeople = () => api.get('/people')
export const createPerson = (data) => api.post('/people', data)
export const updatePerson = (id, data) => api.put(`/people/${id}`, data)
export const deletePerson = (id) => api.delete(`/people/${id}`)
export const getPersonSummary = (id) => api.get(`/people/${id}/summary`)
