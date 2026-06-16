import { useState } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBills, createBill, updateBill, deleteBill, payBill, unpayBill, settleBillParticipant, unsettleBillParticipant } from '@/api/bills'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, getBillingPeriod } from '@/lib/utils'
import { PaymentMethodSelect, PaymentMethodBadge } from '@/components/shared/PaymentMethodSelect'
import { ParticipantsEditor, ME_ID } from '@/components/shared/ParticipantsEditor'
import { SplitTracker } from '@/components/shared/SplitTracker'
import { Plus, Trash2, CheckCircle, Circle, Pencil, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOptimistic, tempId } from '@/lib/optimistic'
import { usePeriod } from '@/contexts/PeriodContext'
import { SkeletonList } from '@/components/shared/Loading'
import { PersonAvatars } from '@/components/shared/PersonAvatars'
import { involvedPeople } from '@/lib/involved'
import { settledPersonIds, isSplit, allSettledAfterToggle } from '@/lib/settlement'

const BILL_CATEGORIES = ['Rent', 'Utilities', 'Subscription', 'Insurance', 'Other']
const EMPTY_FORM = {
  name: '', amount: '', due_day: '1', due_day_2: '16', frequency: 'monthly',
  category: 'Utilities', is_recurring: true, notes: '',
  payment_method: '', payable_to: '', participants: [ME_ID], participant_amounts: {},
}

function PeriodPayButton({ payments, month, year, period, onPay, onUnpay }) {
  const paid = payments.some(p => p.period === period && p.month === month && p.year === year)
  return (
    <button
      onClick={() => paid ? onUnpay(period) : onPay(period)}
      title={paid ? `Undo Period ${period}` : `Pay Period ${period}`}
      className={cn('flex flex-col items-center gap-0.5 transition-colors',
        paid ? 'text-green-500 hover:text-red-400' : 'text-muted-foreground hover:text-primary')}
    >
      {paid ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      <span className="text-[10px]">{period === 1 ? '1–15' : '16+'}</span>
    </button>
  )
}

export default function Bills() {
  const qc = useQueryClient()
  const { month: MONTH, year: YEAR } = usePeriod()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [openIds, setOpenIds] = useState({})
  const toggleOpen = (id) => setOpenIds(o => ({ ...o, [id]: !o[id] }))

  const { data: bills = [], isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => getBills().then(r => r.data) })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  const activeBills = bills.filter(b => {
    const started = b.start_year * 100 + b.start_month <= YEAR * 100 + MONTH
    const ended = b.end_year && b.end_month ? b.end_year * 100 + b.end_month < YEAR * 100 + MONTH : false
    return started && !ended
  })

  const newBillRow = (data) => ({ id: tempId(), payments: [], settlements: [], participants: [], participant_amounts: {}, ...data })

  const addMutation = useOptimistic(qc, ['bills'], {
    mutationFn: createBill,
    apply: (bills, data) => [...bills, newBillRow(data)],
    onSuccess: () => closeForm(),
  })
  const addBiweeklyMutation = useOptimistic(qc, ['bills'], {
    mutationFn: ({ p1, p2 }) => Promise.all([createBill(p1), createBill(p2)]),
    apply: (bills, { p1, p2 }) => [...bills, newBillRow(p1), newBillRow(p2)],
    onSuccess: () => closeForm(),
  })
  const editMutation = useOptimistic(qc, ['bills'], {
    mutationFn: ({ id, data }) => updateBill(id, data),
    apply: (bills, { id, data }) => bills.map(b => (b.id === id ? { ...b, ...data } : b)),
    onSuccess: () => closeForm(),
  })
  const delMutation = useOptimistic(qc, ['bills'], {
    mutationFn: deleteBill,
    apply: (bills, id) => bills.filter(b => b.id !== id),
  })
  const payMutation = useOptimistic(qc, ['bills'], {
    mutationFn: ({ id, period, amount }) => payBill(id, MONTH, YEAR, { period, amount }),
    apply: (bills, { id, period, amount }) => bills.map(b => (b.id === id ? {
      ...b,
      payments: [...(b.payments || []), { id: tempId(), bill_id: id, month: MONTH, year: YEAR, period: period ?? null, amount_paid: amount ?? null }],
    } : b)),
  })
  const unpayMutation = useOptimistic(qc, ['bills'], {
    mutationFn: ({ id, period }) => unpayBill(id, MONTH, YEAR, { period }),
    apply: (bills, { id, period }) => bills.map(b => (b.id === id ? {
      ...b,
      payments: (b.payments || []).filter(p => !(p.month === MONTH && p.year === YEAR && (p.period ?? null) === (period ?? null))),
    } : b)),
  })
  const settleMutation = useOptimistic(qc, ['bills'], {
    mutationFn: ({ id, personId, period, settled }) =>
      settled
        ? unsettleBillParticipant(id, personId, MONTH, YEAR, period)
        : settleBillParticipant(id, personId, MONTH, YEAR, period),
    apply: (bills, { id, personId, period, settled }) => bills.map(b => (b.id === id ? {
      ...b,
      settlements: settled
        ? (b.settlements || []).filter(s => !(s.person_id === personId && s.month === MONTH && s.year === YEAR && (s.period ?? null) === (period ?? null)))
        : [...(b.settlements || []), { id: tempId(), bill_id: id, person_id: personId, month: MONTH, year: YEAR, period: period ?? null }],
    } : b)),
  })

  const isPaidMonthly = (bill) => bill.payments?.some(p => p.month === MONTH && p.year === YEAR && p.period == null)
  const isPaidPeriod = (bill, period) => bill.payments?.some(p => p.month === MONTH && p.year === YEAR && p.period === period)
  const isFullyPaid = (bill) => bill.frequency === 'biweekly'
    ? isPaidPeriod(bill, 1) && isPaidPeriod(bill, 2)
    : isPaidMonthly(bill)

  // Toggle a participant's share on a monthly bill; auto-pay/unpay the bill once
  // everyone has (or no longer has) settled. Biweekly bills keep manual control.
  const toggleShareBill = (bill, personId) => {
    const wasSettled = settledPersonIds(bill, MONTH, YEAR, null).has(personId)
    settleMutation.mutate({ id: bill.id, personId, period: null, settled: wasSettled })
    if (!isSplit(bill)) return
    const allPaid = allSettledAfterToggle(bill, MONTH, YEAR, null, personId, !wasSettled)
    const paidNow = isPaidMonthly(bill)
    if (allPaid && !paidNow) payMutation.mutate({ id: bill.id, period: null })
    else if (!allPaid && paidNow) unpayMutation.mutate({ id: bill.id, period: null })
  }

  const openEdit = (e, bill) => {
    e.stopPropagation()
    setForm({
      name: bill.name,
      amount: bill.amount != null ? String(bill.amount) : '',
      due_day: String(bill.due_day),
      due_day_2: '16',
      frequency: bill.frequency || 'monthly',
      category: bill.category,
      is_recurring: bill.is_recurring,
      notes: bill.notes || '',
      payment_method: bill.payment_method || '',
      payable_to: bill.payable_to ? String(bill.payable_to) : '',
      participants: bill.participants?.length ? bill.participants : [ME_ID],
      participant_amounts: bill.participant_amounts || {},
    })
    setEditingId(bill.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const { due_day_2, ...rest } = form
    const base = {
      ...rest,
      amount: form.amount !== '' ? parseFloat(form.amount) : null,
      payable_to: form.payable_to !== '' ? parseInt(form.payable_to) : null,
    }
    if (editingId) {
      editMutation.mutate({ id: editingId, data: { ...base, due_day: parseInt(form.due_day) } })
      return
    }
    // Biweekly creates two independent monthly bills, one per period.
    if (form.frequency === 'biweekly') {
      const mk = (day) => ({ ...base, frequency: 'monthly', due_day: parseInt(day), start_month: MONTH, start_year: YEAR })
      addBiweeklyMutation.mutate({ p1: mk(form.due_day), p2: mk(form.due_day_2) })
      return
    }
    addMutation.mutate({ ...base, frequency: 'monthly', due_day: parseInt(form.due_day), start_month: MONTH, start_year: YEAR })
  }

  const totalFullyPaid = activeBills.filter(isFullyPaid).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0)
  const totalUnpaid = activeBills.filter(b => !isFullyPaid(b)).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0)

  const sortPaidLast = (arr) => [...arr].sort((a, b) => Number(isFullyPaid(a)) - Number(isFullyPaid(b)))

  // Group by period for display, unpaid first within each group
  const p1Bills = sortPaidLast(activeBills.filter(b => b.frequency === 'biweekly' || getBillingPeriod(b.due_day) === 1))
  const p2Bills = sortPaidLast(activeBills.filter(b => b.frequency === 'biweekly' || getBillingPeriod(b.due_day) === 2))

  const BillCard = ({ bill, open, onToggleOpen }) => {
    const biweekly = bill.frequency === 'biweekly'
    const paid = isFullyPaid(bill)
    const parts = bill.participants || []
    const hasSplit = parts.length > 1
    const payee = bill.payable_to ? people.find(p => p.id === bill.payable_to) : null
    const involved = involvedPeople(bill)
    const lockPaid = hasSplit && !biweekly  // monthly split bills auto-pay from settlements
    const avatarProps = {
      ids: involved.ids, people, roles: involved.roles, title: 'Involved',
      ...(lockPaid ? { settleableIds: parts, settledIds: [...settledPersonIds(bill, MONTH, YEAR, null)], onToggleSettled: (pid) => toggleShareBill(bill, pid) } : {}),
    }
    return (
      <Card>
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Pay button(s) */}
          {biweekly ? (
            <div className="flex gap-2 shrink-0">
              <PeriodPayButton payments={bill.payments || []} month={MONTH} year={YEAR} period={1}
                onPay={p => payMutation.mutate({ id: bill.id, period: p })}
                onUnpay={p => unpayMutation.mutate({ id: bill.id, period: p })} />
              <PeriodPayButton payments={bill.payments || []} month={MONTH} year={YEAR} period={2}
                onPay={p => payMutation.mutate({ id: bill.id, period: p })}
                onUnpay={p => unpayMutation.mutate({ id: bill.id, period: p })} />
            </div>
          ) : (
            <button
              onClick={lockPaid ? undefined : () => paid
                ? unpayMutation.mutate({ id: bill.id, period: null })
                : payMutation.mutate({ id: bill.id, period: null })
              }
              disabled={lockPaid}
              title={lockPaid
                ? (paid ? 'Paid — everyone settled their share' : 'Auto-marks paid once everyone settles their share')
                : (paid ? 'Mark unpaid' : 'Mark paid')}
              className={cn('shrink-0 transition-colors', paid ? 'text-green-500' : 'text-muted-foreground', !lockPaid && (paid ? 'hover:text-red-400' : 'hover:text-primary'), lockPaid && 'cursor-default')}
            >
              {paid ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </button>
          )}

          {/* Name + meta */}
          <button onClick={onToggleOpen} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className={cn('font-medium text-sm truncate', paid && 'text-muted-foreground')}>{bill.name}</span>
              {involved.ids.length > 0 && <PersonAvatars {...avatarProps} />}
              {hasSplit && <Users className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {bill.category}
              {biweekly ? ' · biweekly' : ` · due ${bill.due_day}`}
              {bill.is_recurring && ' · recurring'}
            </p>
          </button>

          {/* Amount */}
          <span className={cn('text-sm font-semibold shrink-0', paid && 'text-muted-foreground line-through')}>
            {bill.amount != null
              ? biweekly ? `${formatCurrency(bill.amount)}×2` : formatCurrency(bill.amount)
              : <span className="text-muted-foreground text-xs font-normal">variable</span>
            }
          </span>

          <button onClick={onToggleOpen} className="shrink-0 text-muted-foreground hover:text-foreground">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-border px-3 py-2.5 space-y-2">
            {(bill.payment_method || payee) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {bill.payment_method && <PaymentMethodBadge value={bill.payment_method} />}
                {payee && <span>Payable to <span className="font-medium text-foreground">{payee.nickname || payee.name}</span></span>}
              </div>
            )}
            {bill.notes && <p className="text-xs text-muted-foreground">{bill.notes}</p>}
            <SplitTracker
              entry={bill}
              amount={bill.amount}
              people={people}
              month={MONTH}
              year={YEAR}
              onToggle={(personId, period, settled) => period == null
                ? toggleShareBill(bill, personId)
                : settleMutation.mutate({ id: bill.id, personId, period, settled })}
            />
            <div className="flex justify-end gap-1.5 pt-0.5">
              <button onClick={e => openEdit(e, bill)} className="flex items-center gap-1 text-xs px-2 py-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"><Pencil className="w-3.5 h-3.5" />Edit</button>
              <button onClick={() => delMutation.mutate(bill.id)} className="flex items-center gap-1 text-xs px-2 py-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent"><Trash2 className="w-3.5 h-3.5" />Delete</button>
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Bills <HelpTip text="Recurring bills grouped by pay period. Mark them paid and track who shares the cost." /></h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Bill
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">Unpaid this month</p><p className="text-lg sm:text-xl font-bold text-red-500 tabular-nums break-words leading-tight">{formatCurrency(totalUnpaid)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">Paid this month</p><p className="text-lg sm:text-xl font-bold text-green-500 tabular-nums break-words leading-tight">{formatCurrency(totalFullyPaid)}</p></CardContent></Card>
      </div>

      {isLoading && <Card><CardContent className="py-2"><SkeletonList rows={4} /></CardContent></Card>}
      {!isLoading && activeBills.length === 0 && <p className="text-sm text-muted-foreground">No active bills.</p>}

      {/* Period 1 */}
      {p1Bills.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1st – 15th</h2>
          {p1Bills.map(b => <BillCard key={b.id} bill={b} open={!!openIds[b.id]} onToggleOpen={() => toggleOpen(b.id)} />)}
        </div>
      )}

      {/* Period 2 */}
      {p2Bills.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">16th – end of month</h2>
          {/* avoid duplicating biweekly bills that already appeared in P1 */}
          {p2Bills.filter(b => b.frequency !== 'biweekly' || !p1Bills.includes(b)).map(b => <BillCard key={b.id} bill={b} open={!!openIds[b.id]} onToggleOpen={() => toggleOpen(b.id)} />)}
        </div>
      )}

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Bill' : 'Add Bill'} className="sm:max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="bill-form" disabled={addMutation.isPending || editMutation.isPending || addBiweeklyMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="bill-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount <span className="text-muted-foreground text-xs">(blank = variable)</span></Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 1500" />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} disabled={!!editingId}>
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly (creates 2 bills)</option>
              </Select>
            </div>
          </div>

          {/* Due day(s) */}
          {form.frequency === 'biweekly' && !editingId ? (
            <>
              <p className="text-xs text-muted-foreground -mb-1">Creates two separate bills — one in each period — that you edit independently.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First due day <span className="text-muted-foreground text-xs">(1–15)</span></Label>
                  <Input type="number" min="1" max="15" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Second due day <span className="text-muted-foreground text-xs">(16–31)</span></Label>
                  <Input type="number" min="16" max="31" value={form.due_day_2} onChange={e => setForm(f => ({ ...f, due_day_2: e.target.value }))} />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Due Day</Label>
              <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
              {form.due_day && (
                <p className="text-xs text-muted-foreground">→ {getBillingPeriod(parseInt(form.due_day)) === 1 ? '1st–15th' : '16th–end'}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{BILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select>
          </div>

          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>

          <div className="space-y-1.5">
            <Label>Payable To <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={form.payable_to} onChange={e => setForm(f => ({ ...f, payable_to: e.target.value }))}>
              <option value="">— none —</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <PaymentMethodSelect value={form.payment_method} onChange={v => setForm(f => ({ ...f, payment_method: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Participants & Split</Label>
            <ParticipantsEditor
              participants={form.participants}
              participantAmounts={form.participant_amounts}
              onParticipantsChange={v => setForm(f => ({ ...f, participants: v }))}
              onAmountsChange={v => setForm(f => ({ ...f, participant_amounts: v }))}
              people={people}
              totalAmount={form.amount}
            />
          </div>

        </form>
      </Modal>
    </div>
  )
}
