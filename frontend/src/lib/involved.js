// Resolve the set of people to surface as header avatars for a money entry —
// split participants plus whoever fronted it / is owed — each tagged with a
// role for the popover. Returns no ids when only "Me" is involved, so callers
// can cheaply skip rendering.

const ME_ID = 0

export function involvedPeople(entry, opts = {}) {
  const { share, payableLabel = 'payable to', paidByLabel = 'fronted it' } = opts
  const parts = entry.participants || []
  const ids = []
  const roles = {}
  const add = (id, text) => {
    if (id == null) return
    roles[id] = roles[id] ? `${roles[id]} · ${text}` : text
    ids.push(id)
  }
  if (parts.length > 1) parts.forEach(pid => add(pid, share ? `shares ${share(pid)}` : 'shares this'))
  if (entry.paid_by != null) add(entry.paid_by, paidByLabel)
  if (entry.payable_to != null) add(entry.payable_to, payableLabel)
  const seen = new Set()
  const uniq = ids.filter(id => (seen.has(id) ? false : seen.add(id)))
  const meaningful = uniq.some(id => id !== ME_ID) || parts.length > 1
  return { ids: meaningful ? uniq : [], roles }
}
