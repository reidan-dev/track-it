import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDeduction, deleteDeduction } from '@/api/deductions'
import { deductedTotal, remainingAmount } from '@/lib/deductions'
import { formatCurrency, cn } from '@/lib/utils'
import { Input, Select } from '@/components/shared/Input'
import { Trash2, ChevronDown, ChevronUp, Plus } from 'lucide-react'

const ME_ID = 0

function personLabel(pid, people) {
  if (pid === ME_ID) return 'Me'
  const p = people.find(x => x.id === pid)
  return p ? (p.nickname || p.name) : 'Unknown'
}

const EMPTY = { amount: '', person_id: '', note: '' }

/**
 * Per-item deduction log for one month/period: amounts already covered outside
 * the split (a promo credit, someone's advance payment). What's left after
 * deductions is the only amount still shared.
 */
export function DeductionsPanel({ itemType, itemId, amount, participants = [], people = [], month, year, period = null, deductions = [] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deductions'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const addMut = useMutation({
    mutationFn: createDeduction,
    onSuccess: () => { setForm(EMPTY); invalidate() },
  })
  const delMut = useMutation({ mutationFn: deleteDeduction, onSuccess: invalidate })

  // Optimistically-created parent rows have temp string ids the API can't target.
  if (typeof itemId !== 'number') return null

  const deducted = deductedTotal(deductions)
  const remaining = remainingAmount(amount, deductions)

  const submit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) return
    addMut.mutate({
      item_type: itemType,
      item_id: itemId,
      month, year, period,
      amount: amt,
      person_id: form.person_id === '' ? null : parseInt(form.person_id),
      note: form.note.trim() || null,
    })
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold hover:text-foreground">
        Deductions
        {deducted > 0 && (
          <span className="normal-case tracking-normal font-medium text-amber-600 dark:text-amber-400">
            −{formatCurrency(deducted)} · {formatCurrency(remaining)} left to split
          </span>
        )}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          {deductions.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-xs rounded-md border border-border px-2 py-1">
              <span className="font-medium tabular-nums">−{formatCurrency(d.amount)}</span>
              <span className="text-muted-foreground truncate">
                {d.person_id != null ? `paid by ${personLabel(d.person_id, people)}` : 'credit'}
                {d.note ? ` · ${d.note}` : ''}
              </span>
              <button type="button" onClick={() => delMut.mutate(d.id)}
                className="ml-auto p-0.5 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          <form onSubmit={submit} className="flex items-center gap-1.5 flex-wrap">
            <Input type="number" step="0.01" min="0" placeholder="Amount" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="h-8 text-xs w-24" required />
            <Select value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}
              className="h-8 text-xs w-32">
              <option value="">No one (credit)</option>
              {participants.map(pid => (
                <option key={pid} value={pid}>{personLabel(pid, people)}</option>
              ))}
            </Select>
            <Input placeholder="Note (optional)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="h-8 text-xs flex-1 min-w-[100px]" />
            <button type="submit" disabled={addMut.isPending}
              className={cn('flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium',
                'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50')}>
              <Plus className="w-3 h-3" />Deduct
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
