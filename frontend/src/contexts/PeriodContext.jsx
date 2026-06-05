import { createContext, useContext, useState } from 'react'

const PeriodContext = createContext(null)
const now = new Date()
const CUR_MONTH = now.getMonth() + 1
const CUR_YEAR = now.getFullYear()

/**
 * App-wide "viewed month" shared by month-based pages (Bills, Installments,
 * Expenses, Income, Summary, Calendar) so a single < Month Year > navigator
 * drives all of them. Lives above the routes so it survives navigation.
 */
export function PeriodProvider({ children }) {
  const [month, setMonth] = useState(CUR_MONTH)
  const [year, setYear] = useState(CUR_YEAR)

  const shift = (delta) => {
    const idx = year * 12 + (month - 1) + delta
    setYear(Math.floor(idx / 12))
    setMonth((idx % 12) + 1)
  }

  const value = {
    month,
    year,
    setMonth,
    setYear,
    prev: () => shift(-1),
    next: () => shift(1),
    reset: () => { setMonth(CUR_MONTH); setYear(CUR_YEAR) },
    isCurrent: month === CUR_MONTH && year === CUR_YEAR,
  }

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider')
  return ctx
}
