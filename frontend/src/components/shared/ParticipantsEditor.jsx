import { cn, formatCurrency } from '@/lib/utils'

// id=0 is the sentinel for "Me"
export const ME_ID = 0

function Avatar({ person }) {
  if (person.id === ME_ID) {
    return (
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
        M
      </div>
    )
  }
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
      style={{ backgroundColor: person.color || '#64748b' }}
    >
      {person.emoji || person.name.charAt(0).toUpperCase()}
    </div>
  )
}

function displayName(person) {
  if (person.id === ME_ID) return 'Me'
  return person.nickname || person.name
}

// ─── Selector (for forms) ────────────────────────────────────────────────────
export function ParticipantsEditor({ participants, participantAmounts, onParticipantsChange, onAmountsChange, people, totalAmount }) {
  const allOptions = [{ id: ME_ID, name: 'Me', nickname: 'Me', emoji: '', color: '#3b82f6' }, ...people]
  const count = participants.length

  const togglePerson = (id) => {
    if (participants.includes(id)) {
      const next = participants.filter(x => x !== id)
      onParticipantsChange(next)
      const nextAmounts = { ...participantAmounts }
      delete nextAmounts[String(id)]
      onAmountsChange(nextAmounts)
    } else {
      onParticipantsChange([...participants, id])
    }
  }

  const setAmount = (id, val) => {
    onAmountsChange({ ...participantAmounts, [String(id)]: val === '' ? '' : val })
  }

  const autoSplit = totalAmount && count > 0 ? (parseFloat(totalAmount) / count).toFixed(2) : null

  return (
    <div className="space-y-3">
      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2">
        {allOptions.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => togglePerson(p.id)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              participants.includes(p.id)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40'
            )}
          >
            <Avatar person={p} />
            {displayName(p)}
          </button>
        ))}
        {people.length === 0 && (
          <p className="text-xs text-muted-foreground">Add people to split with others.</p>
        )}
      </div>

      {/* Per-person amount inputs */}
      {participants.length > 0 && (
        <div className="space-y-2 pl-1">
          {participants.map(id => {
            const person = allOptions.find(p => p.id === id)
            if (!person) return null
            const val = participantAmounts[String(id)] ?? ''
            return (
              <div key={id} className="flex items-center gap-2">
                <Avatar person={person} />
                <span className="text-xs w-20 truncate">{displayName(person)}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={autoSplit ? `auto ${autoSplit}` : 'amount'}
                  value={val}
                  onChange={e => setAmount(id, e.target.value)}
                  className="flex h-7 w-28 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {val === '' && autoSplit && (
                  <span className="text-xs text-muted-foreground">= {formatCurrency(autoSplit)}</span>
                )}
                {val !== '' && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(val)}</span>
                )}
              </div>
            )
          })}

          {/* Split summary */}
          {totalAmount && (
            <SplitSummary participants={participants} participantAmounts={participantAmounts} totalAmount={totalAmount} people={allOptions} />
          )}
        </div>
      )}
    </div>
  )
}

function SplitSummary({ participants, participantAmounts, totalAmount, people }) {
  const total = parseFloat(totalAmount) || 0
  const customTotal = participants.reduce((s, id) => {
    const v = parseFloat(participantAmounts[String(id)])
    return s + (isNaN(v) ? 0 : v)
  }, 0)
  const hasCustom = participants.some(id => participantAmounts[String(id)] !== undefined && participantAmounts[String(id)] !== '')
  if (!hasCustom) return null
  const diff = Math.abs(total - customTotal)
  const ok = diff < 0.01
  return (
    <div className={cn('text-xs px-2 py-1 rounded', ok ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20')}>
      {ok ? '✓ Amounts add up' : `⚠ ${formatCurrency(customTotal)} assigned, ${formatCurrency(total)} total (${formatCurrency(Math.abs(total - customTotal))} ${customTotal > total ? 'over' : 'short'})`}
    </div>
  )
}

// ─── Display badge (cards) ───────────────────────────────────────────────────
export function ParticipantsBadge({ participants, participantAmounts, people, totalAmount }) {
  if (!participants || participants.length === 0) return null
  const allOptions = [{ id: ME_ID, name: 'Me', nickname: 'Me', emoji: '', color: '#3b82f6' }, ...people]
  const count = participants.length
  const autoSplit = totalAmount && count > 0 ? parseFloat(totalAmount) / count : null

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <span className="text-xs text-muted-foreground">split:</span>
      {participants.map(id => {
        const person = allOptions.find(p => p.id === id)
        if (!person) return null
        const customAmt = participantAmounts?.[String(id)]
        const amt = customAmt !== undefined && customAmt !== '' ? parseFloat(customAmt) : autoSplit
        return (
          <span key={id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5">
            <Avatar person={person} />
            <span>{displayName(person)}</span>
            {amt != null && <span className="text-muted-foreground">· {formatCurrency(amt)}</span>}
          </span>
        )
      })}
    </div>
  )
}
