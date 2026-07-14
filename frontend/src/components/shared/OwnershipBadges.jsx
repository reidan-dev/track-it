import { cn, formatCurrency } from '@/lib/utils'
import { Clock, Circle, CheckCircle } from 'lucide-react'

// Tri-state payment check: empty (unpaid) → green (paid & settled by whoever's
// responsible) → yellow (I fronted it — awaiting reimbursement) → empty.
// Items with nobody else involved skip yellow (plain paid/unpaid toggle).
export function TriCheck({ state, onCycle, hasOthers, className, titles = {} }) {
  const title = titles[state] || (
    state === 'empty'
      ? (hasOthers ? 'Unpaid — tap once everyone has paid up' : 'Unpaid — tap to mark paid')
      : state === 'green'
      ? (hasOthers ? 'Paid & settled — tap if you fronted it and are owed back' : 'Paid — tap to mark unpaid')
      : 'You fronted it — awaiting reimbursement · tap to mark unpaid'
  )
  return (
    <button
      type="button"
      onClick={onCycle}
      title={title}
      className={cn('transition-colors',
        state === 'green' ? 'text-green-500 hover:text-amber-500'
          : state === 'yellow' ? 'text-amber-500 hover:text-red-400'
          : 'text-muted-foreground hover:text-primary',
        className)}
    >
      {state === 'empty' ? <Circle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
    </button>
  )
}

// Left accent stripe in the person's color. Solid for items that are someone
// else's obligation (owner/fronted), faint for ordinary splits. Parent needs
// `relative overflow-hidden`.
export function OwnershipStripe({ ownership }) {
  if (!ownership) return null
  return (
    <span
      aria-hidden
      className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-full pointer-events-none',
        ownership.tier === 'shared' ? 'opacity-40' : 'opacity-90')}
      style={{ backgroundColor: ownership.color }}
    />
  )
}

// "🦁 Jay's" chip — only for items that belong to someone else entirely.
export function OwnerChip({ ownership }) {
  if (!ownership || ownership.tier !== 'owner') return null
  const p = ownership.person
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: ownership.color }}
      title={`This is ${ownership.label.toLowerCase()} — you're just tracking it`}
    >
      {p?.emoji && <span>{p.emoji}</span>}
      {ownership.label}
    </span>
  )
}

// Amber "Awaiting ₱X" chip: I've already paid, others' shares outstanding.
export function AwaitingChip({ amount }) {
  if (!amount || amount <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"
      title="You've paid this — waiting for their shares">
      <Clock className="w-3 h-3" />
      Awaiting {formatCurrency(amount)}
    </span>
  )
}
