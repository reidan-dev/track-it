// Deductions: one-off amounts taken off a shared item for a single month
// (promo credit, advance payment). Mirrors backend app/finance.py math.
import { useQuery } from '@tanstack/react-query'
import { getDeductions } from '@/api/deductions'

export function useDeductions(month, year) {
  const { data = [] } = useQuery({
    queryKey: ['deductions', month, year],
    queryFn: () => getDeductions(month, year).then(r => r.data),
  })
  return data
}

export const deductionsFor = (all, itemType, itemId) =>
  (all || []).filter(d => d.item_type === itemType && d.item_id === itemId)

export const deductedTotal = (deductions) =>
  (deductions || []).reduce((s, d) => s + parseFloat(d.amount || 0), 0)

export const remainingAmount = (amount, deductions) =>
  Math.max(0, parseFloat(amount || 0) - deductedTotal(deductions))

/**
 * Per-person shares after deductions. A deduction attributed to a participant
 * covers that person's share first; the excess plus any generic deductions
 * shrinks everyone's remaining shares proportionally (custom splits scale too).
 */
export function effectiveShares(amount, participants, participantAmounts, deductions) {
  const parts = participants || []
  const base = (pid) => {
    if (!amount) return 0
    const custom = participantAmounts?.[String(pid)]
    if (custom != null && custom !== '') return parseFloat(custom)
    return parseFloat(amount) / (parts.length || 1)
  }
  const shares = {}
  for (const pid of parts) shares[pid] = base(pid)
  let pool = 0
  for (const d of deductions || []) {
    const amt = parseFloat(d.amount || 0)
    if (d.person_id != null && shares[d.person_id] != null) {
      const covered = Math.min(amt, shares[d.person_id])
      shares[d.person_id] -= covered
      pool += amt - covered
    } else {
      pool += amt
    }
  }
  const rem = Object.values(shares).reduce((s, v) => s + v, 0)
  if (pool > 0 && rem > 0) {
    const ratio = Math.max(0, 1 - pool / rem)
    for (const k in shares) shares[k] *= ratio
  }
  return shares
}
