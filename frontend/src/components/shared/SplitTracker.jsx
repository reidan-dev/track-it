import { cn, formatCurrency } from '@/lib/utils'
import { Check } from 'lucide-react'

const ME_ID = 0

function shareOf(amount, participants, participantAmounts, pid) {
  if (!amount) return 0
  const custom = participantAmounts?.[String(pid)]
  if (custom != null && custom !== '') return parseFloat(custom)
  const count = participants?.length || 1
  return parseFloat(amount) / count
}

function personLabel(pid, people) {
  if (pid === ME_ID) return 'Me'
  const p = people.find(x => x.id === pid)
  return p ? (p.nickname || p.name) : 'Unknown'
}

function personColor(pid, people) {
  if (pid === ME_ID) return '#3b82f6'
  const p = people.find(x => x.id === pid)
  return p?.color || '#64748b'
}

function personEmoji(pid, people) {
  if (pid === ME_ID) return null
  const p = people.find(x => x.id === pid)
  return p?.emoji
}

/**
 * Per-participant settlement tracker. Shows a clickable chip for each person
 * in a split; green when that person has paid their share for the period.
 * Only renders when there's an actual split (more than one participant).
 */
export function SplitTracker({ entry, amount, people, month, year, onToggle }) {
  const participants = entry.participants || []
  if (participants.length <= 1) return null

  const biweekly = entry.frequency === 'biweekly'
  const periods = biweekly ? [1, 2] : [null]
  const settlements = entry.settlements || []

  const isSettled = (pid, period) =>
    settlements.some(s =>
      s.person_id === pid && s.month === month && s.year === year &&
      (s.period ?? null) === (period ?? null)
    )

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Who paid their share</p>
      {periods.map(period => (
        <div key={period ?? 'm'} className="flex items-center gap-1.5 flex-wrap">
          {biweekly && <span className="text-[10px] text-muted-foreground w-4 shrink-0">P{period}</span>}
          {participants.map(pid => {
            const settled = isSettled(pid, period)
            const share = shareOf(amount, participants, entry.participant_amounts, pid)
            return (
              <button
                key={pid}
                onClick={() => onToggle(pid, period, settled)}
                title={`${personLabel(pid, people)}: ${formatCurrency(share)} — ${settled ? 'paid (click to undo)' : 'not paid'}`}
                className={cn(
                  'flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full text-[11px] border transition-colors',
                  settled
                    ? 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold shrink-0"
                  style={{ backgroundColor: personColor(pid, people) }}
                >
                  {personEmoji(pid, people) || personLabel(pid, people).charAt(0).toUpperCase()}
                </span>
                <span>{personLabel(pid, people)}</span>
                {settled
                  ? <Check className="w-3 h-3" />
                  : <span className="w-3 h-3 rounded-full border border-current opacity-50" />
                }
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
