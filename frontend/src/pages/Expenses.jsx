import { useState } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, updateExpense, deleteExpense, settleExpenseParticipant, unsettleExpenseParticipant, getExpenseReceipt } from '@/api/expenses'
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
import { settledPersonIds, isSplit, allSettledAfterToggle } from '@/lib/settlement'
import { Plus, Trash2, Pencil, Users, Paperclip, CalendarClock, CheckCircle, Circle } from 'lucide-react'
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

  const { data: expenses = [], refetch, isLoading } = useQuery({
    queryKey: ['expenses', month, year, period],
    queryFn: () => getExpenses({ month, year, ...(period ? { period } : {}) }).then(r => r.data),
  })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

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
  const toggleShare = (e, personId) => {
    const wasSettled = settledPersonIds(e, e.month, e.year).has(personId)
    settleMutation.mutate({ id: e.id, personId, period: null, settled: wasSettled, m: e.month, y: e.year })
    if (!isSplit(e)) return
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
      paid_by: e.paid_by ?? null,
      payable_to: e.payable_to ?? null,
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
    const payload = { ...form, amount: parseFloat(form.amount), due_date: form.due_date || null, period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear() }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Expenses <HelpTip text="Log spending by category and payment method. Add participants to split a cost and track who pays you back." /></h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Expense
        </Button>
      </div>

      <div className="flex gap-2">
        {[null, 1, 2].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {p === null ? 'All' : (p === 1 ? '1st–15th' : '16th–end')}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Total</CardTitle>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading
            ? <SkeletonList rows={4} />
            : expenses.length === 0
            ? <p className="text-sm text-muted-foreground py-4 text-center">No expenses found.</p>
            : (
              <ul className="divide-y divide-border">
                {expenses.map(e => {
                  const parts = e.participants || []
                  const hasSplit = parts.length > 1
                  const involved = involvedFor(e)
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
                        <div className="py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={hasSplit ? undefined : () => paidMutation.mutate({ id: e.id, is_paid: !e.is_paid })}
                              disabled={hasSplit}
                              title={hasSplit
                                ? (e.is_paid ? 'Paid — everyone settled their share' : 'Auto-marks paid once everyone settles their share')
                                : (e.is_paid ? 'Mark unpaid' : 'Mark paid')}
                              className={cn('shrink-0 transition-colors', e.is_paid ? 'text-green-500' : 'text-muted-foreground', !hasSplit && (e.is_paid ? 'hover:text-red-400' : 'hover:text-primary'), hasSplit && 'cursor-default')}
                            >
                              {e.is_paid ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              {e.name && <p className="font-medium text-sm flex items-center gap-1.5 min-w-0"><span className={cn('truncate', e.is_paid && 'text-muted-foreground line-through')}>{e.name}</span>{involved.ids.length > 0 && <PersonAvatars {...avatarProps} />}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="muted">{e.category}</Badge>
                                <span className="text-xs text-muted-foreground">{e.date}</span>
                                {!e.name && involved.ids.length > 0 && <PersonAvatars {...avatarProps} />}
                                {hasSplit && <Users className="w-3 h-3 text-muted-foreground" />}
                                {e.has_receipt && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                                {e.payment_method && <PaymentMethodBadge value={e.payment_method} />}
                              </div>
                              {(e.paid_by || e.payable_to || e.due_date) && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
                                  <CalendarClock className="w-3 h-3 shrink-0" />
                                  {e.paid_by ? <span>paid by {personName(people, e.paid_by)}</span> : null}
                                  {e.payable_to ? <span>· owe {personName(people, e.payable_to)}</span> : null}
                                  {e.due_date ? <span>· due {e.due_date}</span> : null}
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
                            onToggle={(personId) => toggleShare(e, personId)}
                          />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Paid by <span className="text-muted-foreground text-xs">(who fronted it)</span></Label>
              <PersonSelect value={form.paid_by} onChange={v => setForm(f => ({ ...f, paid_by: v }))} people={people} includeMe />
            </div>
            <div className="space-y-1.5">
              <Label>Payable to <span className="text-muted-foreground text-xs">(who you owe)</span></Label>
              <PersonSelect value={form.payable_to} onChange={v => setForm(f => ({ ...f, payable_to: v }))} people={people} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due date <span className="text-muted-foreground text-xs">(when you repay — optional)</span></Label>
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
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
