import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, updateExpense, deleteExpense } from '@/api/expenses'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, EXPENSE_CATEGORIES, getBillingPeriod } from '@/lib/utils'
import { PaymentMethodSelect, PaymentMethodBadge } from '@/components/shared/PaymentMethodSelect'
import { Plus, Trash2, Pencil } from 'lucide-react'

const now = new Date()
const EMPTY_FORM = { amount: '', category: 'Food', date: now.toISOString().slice(0, 10), note: '', payment_method: '' }

export default function Expenses() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [period, setPeriod] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', month, year, period],
    queryFn: () => getExpenses({ month, year, ...(period ? { period } : {}) }).then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const addMutation = useMutation({ mutationFn: createExpense, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updateExpense(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deleteExpense, onSuccess: invalidate })

  const openEdit = (e) => {
    setForm({ amount: String(e.amount), category: e.category, date: e.date, note: e.note || '', payment_method: e.payment_method || '' })
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
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Expense
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-36">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString('default', { month: 'long' })}</option>
          ))}
        </Select>
        <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" />
        <div className="flex gap-2">
          {[null, 1, 2].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {p === null ? 'All' : `Period ${p}`}
            </button>
          ))}
        </div>
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
                {expenses.map(e => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="muted">{e.category}</Badge>
                        <span className="text-xs text-muted-foreground">{e.date} · P{e.period}</span>
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
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Expense' : 'Add Expense'}
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
        </form>
      </Modal>
    </div>
  )
}
