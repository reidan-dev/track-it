import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBills, createBill, deleteBill, payBill } from '@/api/bills'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react'

const now = new Date()
const BILL_CATEGORIES = ['Rent', 'Utilities', 'Subscription', 'Insurance', 'Other']

export default function Bills() {
  const qc = useQueryClient()
  const [month] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', due_day: '1', category: 'Utilities', is_recurring: true, notes: '' })

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => getBills().then(r => r.data),
  })

  const activeBills = bills.filter(b => {
    const started = b.start_year * 100 + b.start_month <= year * 100 + month
    const ended = b.end_year && b.end_month ? b.end_year * 100 + b.end_month < year * 100 + month : false
    return started && !ended
  })

  const addMutation = useMutation({
    mutationFn: createBill,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); setShowAdd(false) },
  })

  const delMutation = useMutation({
    mutationFn: deleteBill,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  })

  const payMutation = useMutation({
    mutationFn: ({ id }) => payBill(id, month, year),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  })

  const isPaid = (bill) => bill.payments?.some(p => p.month === month && p.year === year)

  const handleAdd = (e) => {
    e.preventDefault()
    addMutation.mutate({ ...form, amount: parseFloat(form.amount), due_day: parseInt(form.due_day), start_month: month, start_year: year })
  }

  const totalPaid = activeBills.filter(isPaid).reduce((s, b) => s + parseFloat(b.amount), 0)
  const totalUnpaid = activeBills.filter(b => !isPaid(b)).reduce((s, b) => s + parseFloat(b.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Bill</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Unpaid this month</p><p className="text-xl font-bold text-red-500">{formatCurrency(totalUnpaid)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Paid this month</p><p className="text-xl font-bold text-green-500">{formatCurrency(totalPaid)}</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {activeBills.length === 0 && <p className="text-sm text-muted-foreground">No active bills.</p>}
        {activeBills.map((bill) => {
          const paid = isPaid(bill)
          return (
            <Card key={bill.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => !paid && payMutation.mutate({ id: bill.id })} disabled={paid} className="text-muted-foreground">
                    {paid ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div>
                    <p className="font-medium text-sm">{bill.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="muted">{bill.category}</Badge>
                      <span className="text-xs text-muted-foreground">Due: {bill.due_day}th</span>
                      {bill.is_recurring && <Badge variant="default">recurring</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${paid ? 'text-muted-foreground line-through' : ''}`}>{formatCurrency(bill.amount)}</span>
                  <button onClick={() => delMutation.mutate(bill.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Bill">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due Day</Label><Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{BILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
