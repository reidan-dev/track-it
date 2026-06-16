// Helpers for per-participant settlement state shared by Expenses, Bills, and
// Installments. A "settlement" row means a person has paid their share of an
// item for a given month/year (and period, for biweekly items).

export function settledPersonIds(entry, month, year, period = null) {
  return new Set(
    (entry.settlements || [])
      .filter(s => s.month === month && s.year === year && (s.period ?? null) === (period ?? null))
      .map(s => s.person_id)
  )
}

export function isSplit(entry) {
  return (entry.participants?.length || 0) > 1
}

// Would every participant be settled for this period if `personId` flips to
// `willBeSettled`? Used to auto-mark the whole item paid once everyone's in.
export function allSettledAfterToggle(entry, month, year, period, personId, willBeSettled) {
  const parts = entry.participants || []
  if (parts.length === 0) return false
  const set = settledPersonIds(entry, month, year, period)
  if (willBeSettled) set.add(personId)
  else set.delete(personId)
  return parts.every(p => set.has(p))
}
