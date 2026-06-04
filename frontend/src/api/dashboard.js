import api from './client'

export const getDashboardSummary = (month, year) =>
  api.get('/dashboard/summary', { params: { month, year } })

export const getCalendarEvents = (month, year) =>
  api.get('/calendar/events', { params: { month, year } })
