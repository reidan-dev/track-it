import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, deleteExpense } from '@/api/expenses'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, EXPENSE_CATEGORIES, getBillingPeriod } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

const now = new Date()

export default function Expenses() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [period, setPeriod] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    amount: '', category: 'Food', date: now.toISOString().slice(0, 10), note: '',
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', month, year, period],
    queryFn: () => getExpenses({ month, year, ...(period ? { period } : {}) }).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowAdd(false)
      setForm({ amount: '', category: 'Food', date: now.toISOString().slice(0, 10), note: '' })
    },
  })

  const delMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const handleAdd = (e) => {
    e.preventDefault()
    const d = new Date(form.date)
    addMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
      period: getBillingPeriod(d.getDate()),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    })
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Expense</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2024, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </Select>
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" />
        <div className="flex gap-2">
          {[null, 1, 2].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            >
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
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expenses found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="muted">{e.category}</Badge>
                      <span className="text-muted-foreground">{e.date}</span>
                      <span className="text-xs text-muted-foreground">P{e.period}</span>
                    </div>
                    {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(e.amount)}</span>
                    <button onClick={() => delMutation.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
