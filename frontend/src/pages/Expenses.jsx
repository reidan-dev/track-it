import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExpenses, searchExpenses, createExpense, updateExpense, deleteExpense, settleExpenseParticipant, unsettleExpenseParticipant, getExpenseReceipt } from '@/api/expenses'
import { getPeople } from '@/api/people'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, EXPENSE_CATEGORIES, getBillingPeriod } from '@/lib/utils'
import { PaymentMethodSelect, PaymentMethodBadge } from '@/components/shared/PaymentMethodSelect'
import { ParticipantsEditor, ME_ID } from '@/components/shared/ParticipantsEditor'
import { PersonSelect, personName } from '@/components/shared/PersonSelect'
import { SplitTracker } from '@/components/shared/SplitTracker'
import { ReceiptCapture } from '@/components/shared/ReceiptCapture'
import { SwipeableRow } from '@/components/shared/SwipeableRow'
import { PullToRefresh } from '@/components/shared/PullToRefresh'
import { SkeletonList } from '@/components/shared/Loading'
import { PersonAvatars } from '@/components/shared/PersonAvatars'
import { involvedPeople } from '@/lib/involved'
import { ownershipOf, awaitingAmount } from '@/lib/ownership'
import { OwnershipStripe, OwnerChip, AwaitingChip, TriCheck } from '@/components/shared/OwnershipBadges'
import { settledPersonIds, isSplit, allSettledAfterToggle } from '@/lib/settlement'
import { useDeductions, deductionsFor, remainingAmount } from '@/lib/deductions'
import { DeductionsPanel } from '@/components/shared/DeductionsPanel'
import { Plus, Trash2, Pencil, Users, Paperclip, CalendarClock, CheckCircle, Circle, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOptimistic, tempId } from '@/lib/optimistic'
import { usePeriod } from '@/contexts/PeriodContext'

const now = new Date()
const EMPTY_FORM = {
  name: '', amount: '', category: 'Food', date: now.toISOString().slice(0, 10), note: '',
  payment_method: '', participants: [ME_ID], participant_amounts: {}, receipt_image: null,
  paid_by: null, payable_to: null, due_date: '',
}

function shareOf(amount, participants, participantAmounts, pid) {
  if (!amount) return 0
  const custom = participantAmounts?.[String(pid)]
  if (custom != null && custom !== '') return parseFloat(custom)
  return parseFloat(amount) / (participants?.length || 1)
}

// The person I owe for this expense: whoever fronted it, or an explicit payee
// on older entries. null = nobody (I paid it myself).
const creditorOf = (e) => e.payable_to ?? (e.paid_by && e.paid_by !== ME_ID ? e.paid_by : null)

const involvedFor = (e) => involvedPeople(e, {
  share: (pid) => formatCurrency(shareOf(e.amount, e.participants || [], e.participant_amounts, pid)),
  payableLabel: 'you owe',
})

export default function Expenses() {
  const qc = useQueryClient()
  const { month, year } = usePeriod()
  const [period, setPeriod] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  const searching = debounced.length > 0

  const { data: monthExpenses = [], refetch, isLoading } = useQuery({
    queryKey: ['expenses', month, year, period],
    queryFn: () => getExpenses({ month, year, ...(period ? { period } : {}) }).then(r => r.data),
  })
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['expenses-search', debounced],
    queryFn: () => searchExpenses({ q: debounced }).then(r => r.data),
    enabled: searching,
  })
  const expenses = searching ? searchResults : monthExpenses
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })
  const allDeductions = useDeductions(month, year)

  const expensesKey = ['expenses', month, year, period]
  const also = [['expenses'], ['dashboard']]

  const addMutation = useOptimistic(qc, expensesKey, {
    mutationFn: createExpense,
    apply: (list, data) => [{ id: tempId(), settlements: [], ...data, has_receipt: !!data.receipt_image }, ...list],
    onSuccess: () => closeForm(),
    also,
  })
  const editMutation = useOptimistic(qc, expensesKey, {
    mutationFn: ({ id, data }) => updateExpense(id, data),
    apply: (list, { id, data }) => list.map(e => (e.id === id ? { ...e, ...data, has_receipt: !!data.receipt_image } : e)),
    onSuccess: () => closeForm(),
    also,
  })
  const delMutation = useOptimistic(qc, expensesKey, {
    mutationFn: deleteExpense,
    apply: (list, id) => list.filter(e => e.id !== id),
    also,
  })
  const paidMutation = useOptimistic(qc, expensesKey, {
    mutationFn: ({ id, is_paid }) => updateExpense(id, { is_paid }),
    apply: (list, { id, is_paid }) => list.map(e => (e.id === id ? { ...e, is_paid } : e)),
    also,
  })
  const settleMutation = useOptimistic(qc, expensesKey, {
    mutationFn: ({ id, personId, period: prd, settled, m, y }) =>
      settled
        ? unsettleExpenseParticipant(id, personId, m, y, prd)
        : settleExpenseParticipant(id, personId, m, y, prd),
    apply: (list, { id, personId, period: prd, settled, m, y }) => list.map(e => (e.id === id ? {
      ...e,
      settlements: settled
        ? (e.settlements || []).filter(s => !(s.person_id === personId && s.month === m && s.year === y && (s.period ?? null) === (prd ?? null)))
        : [...(e.settlements || []), { id: tempId(), expense_id: id, person_id: personId, month: m, year: y, period: prd ?? null }],
    } : e)),
    also,
  })

  // Toggle one participant's share. When a split's last person settles, the
  // whole expense auto-flips to paid; un-settling anyone flips it back.
  // Expenses someone else fronted are exempt: there, is_paid means "I repaid
  // them" and is toggled manually, independent of participants' shares.
  const toggleShare = (e, personId) => {
    const wasSettled = settledPersonIds(e, e.month, e.year).has(personId)
    settleMutation.mutate({ id: e.id, personId, period: null, settled: wasSettled, m: e.month, y: e.year })
    if (!isSplit(e) || creditorOf(e)) return
    const allPaid = allSettledAfterToggle(e, e.month, e.year, null, personId, !wasSettled)
    if (allPaid && !e.is_paid) paidMutation.mutate({ id: e.id, is_paid: true })
    else if (!allPaid && e.is_paid) paidMutation.mutate({ id: e.id, is_paid: false })
  }

  const openEdit = (e) => {
    setForm({
      name: e.name || '',
      amount: String(e.amount),
      category: e.category,
      date: e.date,
      note: e.note || '',
      payment_method: e.payment_method || '',
      participants: e.participants?.length ? e.participants : [ME_ID],
      participant_amounts: e.participant_amounts || {},
      receipt_image: null,
      // Legacy entries may have payable_to without paid_by — treat either as
      // "this person fronted it" so the Who-paid control picks them up.
      paid_by: creditorOf(e),
      payable_to: null,
      due_date: e.due_date || '',
    })
    setEditingId(e.id)
    setShowForm(true)
    // Receipt image is excluded from the list payload; fetch it lazily.
    if (e.has_receipt) {
      setReceiptLoading(true)
      getExpenseReceipt(e.id)
        .then(r => setForm(f => ({ ...f, receipt_image: r.data.receipt_image })))
        .catch(() => {})
        .finally(() => setReceiptLoading(false))
    }
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setReceiptLoading(false) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const d = new Date(form.date)
    const fronted = form.paid_by && form.paid_by !== ME_ID ? form.paid_by : null
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      paid_by: fronted,
      payable_to: fronted, // I owe whoever fronted it; both fields stay in sync
      due_date: fronted && form.due_date ? form.due_date : null,
      period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear(),
    }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        help="Log spending by category and payment method. Add participants to split a cost, or record who fronted it so it shows up in your balances."
      >
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Expense
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedControl
          options={[{ value: null, label: 'All' }, { value: 1, label: '1st–15th' }, { value: 2, label: '16th–end' }]}
          value={period}
          onChange={setPeriod}
        />
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all months…"
            className="w-full h-9 rounded-lg border border-input bg-card pl-8 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{searching ? `Results for “${debounced}” · all months` : 'Total'}</CardTitle>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {(searching ? searchLoading : isLoading)
            ? <SkeletonList rows={4} />
            : expenses.length === 0
            ? <p className="text-sm text-muted-foreground py-4 text-center">{searching ? 'No matches across any month.' : 'No expenses found.'}</p>
            : (
              <ul className="divide-y divide-border">
                {expenses.map(e => {
                  const parts = e.participants || []
                  const hasSplit = parts.length > 1
                  const creditor = creditorOf(e)
                  const deductions = deductionsFor(allDeductions, 'expense', e.id)
                  const involved = involvedFor(e)
                  const own = ownershipOf(e, people)
                  const others = parts.filter(p => p !== ME_ID)
                  const unsettledIds = others.filter(pid => !settledPersonIds(e, e.month, e.year).has(pid))
                  // Tri-state check. Creditor expenses stay binary (green =
                  // repaid them). Split expenses I paid for skip "empty" —
                  // the purchase already happened — so they cycle yellow ↔ green.
                  let checkState, cycleCheck
                  if (creditor || others.length === 0) {
                    checkState = e.is_paid ? 'green' : 'empty'
                    cycleCheck = () => paidMutation.mutate({ id: e.id, is_paid: !e.is_paid })
                  } else if (unsettledIds.length) {
                    checkState = 'yellow'
                    cycleCheck = () => {
                      unsettledIds.forEach(pid => settleMutation.mutate({ id: e.id, personId: pid, period: null, settled: false, m: e.month, y: e.year }))
                      if (!e.is_paid) paidMutation.mutate({ id: e.id, is_paid: true })
                    }
                  } else {
                    checkState = 'green'
                    cycleCheck = () => {
                      others.forEach(pid => settleMutation.mutate({ id: e.id, personId: pid, period: null, settled: true, m: e.month, y: e.year }))
                      if (e.is_paid) paidMutation.mutate({ id: e.id, is_paid: false })
                    }
                  }
                  // The purchase is the advance: shares are "awaiting" unless
                  // someone else fronted it and I haven't repaid them yet.
                  const awaiting = own?.tier === 'owner' || (creditor && !e.is_paid)
                    ? 0
                    : awaitingAmount(e, e.amount, e.month, e.year, [null], deductions)
                  const settledIds = [...settledPersonIds(e, e.month, e.year)]
                  const avatarProps = {
                    ids: involved.ids, people, roles: involved.roles, title: 'Involved',
                    ...(hasSplit ? { settleableIds: parts, settledIds, onToggleSettled: (pid) => toggleShare(e, pid) } : {}),
                  }
                  return (
                    <li key={e.id}>
                      <SwipeableRow actions={[
                        { icon: Pencil, label: 'Edit', onClick: () => openEdit(e), className: 'bg-blue-500' },
                        { icon: Trash2, label: 'Delete', onClick: () => delMutation.mutate(e.id), className: 'bg-destructive' },
                      ]}>
                        <div className="relative py-2.5 pl-2.5 text-sm">
                          <OwnershipStripe ownership={own} />
                          <div className="flex items-center justify-between gap-2">
                            <TriCheck
                              className="shrink-0"
                              state={checkState}
                              hasOthers={others.length > 0}
                              onCycle={cycleCheck}
                              titles={creditor ? {
                                empty: `Tap once you've repaid ${personName(people, creditor)}`,
                                green: `Repaid ${personName(people, creditor)} — tap to undo`,
                              } : others.length ? {
                                yellow: 'You paid — awaiting their shares · tap once everyone paid you back',
                                green: 'Everyone paid you back — tap to undo',
                              } : {}}
                            />
                            <div className="min-w-0 flex-1">
                              {e.name && <p className="font-medium text-sm flex items-center gap-1.5 min-w-0"><span className={cn('truncate', e.is_paid && 'text-muted-foreground line-through')}>{e.name}</span><OwnerChip ownership={own} />{involved.ids.length > 0 && <PersonAvatars {...avatarProps} />}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="muted">{e.category}</Badge>
                                <span className="text-xs text-muted-foreground">{e.date}</span>
                                {!e.name && involved.ids.length > 0 && <PersonAvatars {...avatarProps} />}
                                {hasSplit && <Users className="w-3 h-3 text-muted-foreground" />}
                                {!e.name && <OwnerChip ownership={own} />}
                                {e.has_receipt && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                                {e.payment_method && <PaymentMethodBadge value={e.payment_method} />}
                                <AwaitingChip amount={awaiting} />
                              </div>
                              {creditor && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs">
                                  <CalendarClock className="w-3 h-3 shrink-0 text-muted-foreground" />
                                  <span className="text-muted-foreground">{personName(people, creditor)} fronted it</span>
                                  {e.is_paid
                                    ? <span className="text-green-600 dark:text-green-400 font-medium">· repaid</span>
                                    : <>
                                        <span className="text-red-500 font-medium">· you owe {formatCurrency(remainingAmount(e.amount, deductions))}</span>
                                        {e.due_date && <span className="text-muted-foreground">· by {e.due_date}</span>}
                                      </>}
                                </div>
                              )}
                              {e.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.note}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn('font-medium', e.is_paid && 'text-muted-foreground line-through')}>{formatCurrency(e.amount)}</span>
                              {/* Inline actions on desktop; mobile uses swipe */}
                              <button onClick={() => openEdit(e)} className="hidden sm:inline-flex p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => delMutation.mutate(e.id)} className="hidden sm:inline-flex p-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <SplitTracker
                            entry={e}
                            amount={e.amount}
                            people={people}
                            month={e.month}
                            year={e.year}
                            deductions={deductions}
                            onToggle={(personId) => toggleShare(e, personId)}
                          />
                          {(hasSplit || deductions.length > 0) && (
                            <div className="mt-2">
                              <DeductionsPanel
                                itemType="expense"
                                itemId={e.id}
                                amount={e.amount}
                                participants={parts}
                                people={people}
                                month={e.month}
                                year={e.year}
                                deductions={deductions}
                              />
                            </div>
                          )}
                        </div>
                      </SwipeableRow>
                    </li>
                  )
                })}
              </ul>
            )}
        </CardContent>
      </Card>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Expense' : 'Add Expense'} className="sm:max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="expense-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
          <div className="space-y-1.5">
            <Label>Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Grocery run, Dinner out" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Transaction date</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Who paid?</Label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
              {[
                { key: 'me', label: 'I paid' },
                { key: 'other', label: 'Someone else' },
              ].map(opt => {
                const active = (opt.key === 'me') === !form.paid_by
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, paid_by: opt.key === 'me' ? null : (f.paid_by || people[0]?.id || null), due_date: opt.key === 'me' ? '' : f.due_date }))}
                    className={cn('h-9 rounded-md text-sm font-medium transition-colors',
                      active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {people.length === 0 && (
              <p className="text-xs text-muted-foreground">Add people in the People page to track who fronted an expense.</p>
            )}
            {form.paid_by ? (
              <div className="space-y-2 rounded-lg border border-border p-3 mt-1">
                <div className="space-y-1.5">
                  <Label>Who fronted it? <span className="text-muted-foreground text-xs">(you'll owe them the full amount)</span></Label>
                  <PersonSelect value={form.paid_by} onChange={v => setForm(f => ({ ...f, paid_by: v }))} people={people} />
                </div>
                <div className="space-y-1.5">
                  <Label>Repay by <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <PaymentMethodSelect value={form.payment_method} onChange={v => setForm(f => ({ ...f, payment_method: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Receipt <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <ReceiptCapture value={form.receipt_image} loading={receiptLoading}
              onChange={v => setForm(f => ({ ...f, receipt_image: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Participants & Split <span className="text-muted-foreground text-xs">(who shares this cost)</span></Label>
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
    </PullToRefresh>
  )
}
