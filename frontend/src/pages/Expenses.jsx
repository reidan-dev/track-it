import { useState } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, updateExpense, deleteExpense, settleExpenseParticipant, unsettleExpenseParticipant } from '@/api/expenses'
import { getPeople } from '@/api/people'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, EXPENSE_CATEGORIES, getBillingPeriod } from '@/lib/utils'
import { PaymentMethodSelect, PaymentMethodBadge } from '@/components/shared/PaymentMethodSelect'
import { ParticipantsEditor, ME_ID } from '@/components/shared/ParticipantsEditor'
import { SplitTracker } from '@/components/shared/SplitTracker'
import { Plus, Trash2, Pencil, Users } from 'lucide-react'
import { useOptimistic, tempId } from '@/lib/optimistic'
import { usePeriod } from '@/contexts/PeriodContext'

const now = new Date()
const EMPTY_FORM = {
  name: '', amount: '', category: 'Food', date: now.toISOString().slice(0, 10), note: '',
  payment_method: '', participants: [ME_ID], participant_amounts: {},
}

export default function Expenses() {
  const qc = useQueryClient()
  const { month, year } = usePeriod()
  const [period, setPeriod] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', month, year, period],
    queryFn: () => getExpenses({ month, year, ...(period ? { period } : {}) }).then(r => r.data),
  })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  const expensesKey = ['expenses', month, year, period]
  const also = [['expenses'], ['dashboard']]

  const addMutation = useOptimistic(qc, expensesKey, {
    mutationFn: createExpense,
    apply: (list, data) => [{ id: tempId(), settlements: [], ...data }, ...list],
    onSuccess: () => closeForm(),
    also,
  })
  const editMutation = useOptimistic(qc, expensesKey, {
    mutationFn: ({ id, data }) => updateExpense(id, data),
    apply: (list, { id, data }) => list.map(e => (e.id === id ? { ...e, ...data } : e)),
    onSuccess: () => closeForm(),
    also,
  })
  const delMutation = useOptimistic(qc, expensesKey, {
    mutationFn: deleteExpense,
    apply: (list, id) => list.filter(e => e.id !== id),
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
    })
    setEditingId(e.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const d = new Date(form.date)
    const payload = { ...form, amount: parseFloat(form.amount), period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear() }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
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
          {expenses.length === 0
            ? <p className="text-sm text-muted-foreground py-4 text-center">No expenses found.</p>
            : (
              <ul className="divide-y divide-border">
                {expenses.map(e => {
                  const hasSplit = (e.participants?.length || 0) > 1
                  return (
                    <li key={e.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          {e.name && <p className="font-medium text-sm truncate">{e.name}</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="muted">{e.category}</Badge>
                            <span className="text-xs text-muted-foreground">{e.date}</span>
                            {hasSplit && <Users className="w-3 h-3 text-muted-foreground" />}
                            {e.payment_method && <PaymentMethodBadge value={e.payment_method} />}
                          </div>
                          {e.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{formatCurrency(e.amount)}</span>
                          <button onClick={() => openEdit(e)} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => delMutation.mutate(e.id)} className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
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
                        onToggle={(personId, prd, settled) => settleMutation.mutate({ id: e.id, personId, period: prd, settled, m: e.month, y: e.year })}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
        </CardContent>
      </Card>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Expense' : 'Add Expense'} className="max-w-lg"
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
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
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
  )
}
