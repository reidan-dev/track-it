// Who an entry "belongs to", for the ownership stripe + chip on list rows.
//
// Tiers:
//   owner   — I'm not a participant: the whole obligation is someone else's
//   fronted — someone else fronted it / receives the payment (paid_by / payable_to)
//   shared  — split between me and others
import { settledPersonIds } from '@/lib/settlement'
import { effectiveShares } from '@/lib/deductions'

const ME_ID = 0

const nameOf = (p) => (p ? p.nickname || p.name : 'Someone')

export function ownershipOf(entry, people) {
  const parts = entry.participants || []
  const others = parts.filter((id) => id !== ME_ID)
  const isMine = parts.length === 0 || parts.includes(ME_ID)
  const find = (id) => people.find((p) => p.id === id)

  if (!isMine && others.length > 0) {
    const person = find(others[0])
    return {
      tier: 'owner',
      person,
      label: others.length > 1 ? 'Others’' : `${nameOf(person)}’s`,
      color: person?.color || '#64748b',
    }
  }
  const creditorId = entry.payable_to ?? (entry.paid_by && entry.paid_by !== ME_ID ? entry.paid_by : null)
  if (creditorId) {
    const person = find(creditorId)
    return { tier: 'fronted', person, label: `${nameOf(person)} fronted`, color: person?.color || '#64748b' }
  }
  if (others.length > 0) {
    const person = find(others[0])
    return { tier: 'shared', person, label: 'shared', color: person?.color || '#64748b' }
  }
  return null
}

// Total of other participants' shares that are still unsettled for the given
// already-paid periods (pass [null] for monthly items, paid period numbers for
// biweekly ones, [] when the item isn't paid yet).
export function awaitingAmount(entry, amount, month, year, paidPeriods, deductions = []) {
  const parts = entry.participants || []
  const others = parts.filter((id) => id !== ME_ID)
  if (!others.length || !paidPeriods.length || !amount) return 0
  let total = 0
  for (const period of paidPeriods) {
    const settled = settledPersonIds(entry, month, year, period)
    const shares = effectiveShares(amount, parts, entry.participant_amounts,
      deductions.filter((d) => (d.period ?? null) === (period ?? null)))
    for (const pid of others) {
      if (settled.has(pid)) continue
      total += shares[pid] ?? 0
    }
  }
  return total
}
