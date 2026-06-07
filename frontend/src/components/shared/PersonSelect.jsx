import { Select } from '@/components/shared/Input'

// A native person picker. `value` is a person id (number), or null for the
// empty choice. When `includeMe` is set, the empty choice means "Me" (null);
// otherwise it means "none".
export function PersonSelect({ value, onChange, people, includeMe = false, noneLabel = '— none —', className }) {
  return (
    <Select
      className={className}
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">{includeMe ? 'Me' : noneLabel}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji ? `${p.emoji} ` : ''}{p.nickname || p.name}
        </option>
      ))}
    </Select>
  )
}

// Resolve a person id to a display name. null/0 → "Me".
export function personName(people, id) {
  if (id == null || id === 0) return 'Me'
  const p = people.find((x) => x.id === id)
  return p ? (p.nickname || p.name) : 'Unknown'
}
