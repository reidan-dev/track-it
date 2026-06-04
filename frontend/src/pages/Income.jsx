import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIncome, createIncome, deleteIncome } from '@/api/income'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, INCOME_TYPES, getBillingPeriod } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

const now = new Date()

export default function Income() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ source: '', amount: '', date: now.toISOString().slice(0, 10), type: 'Salary' })

  const { data: entries = [] } = useQuery({
    queryKey: ['income', month, year],
    queryFn: () => getIncome({ month, year }).then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setShowAdd(false) },
  })
  const delMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['income'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })

  const total = entries.reduce((s, e) => s + parseFloat(e.amount), 0)
  const p1 = entries.filter(e => e.period === 1).reduce((s, e) => s + parseFloat(e.amount), 0)
  const p2 = entries.filter(e => e.period === 2).reduce((s, e) => s + parseFloat(e.amount), 0)

  const handleAdd = (e) => {
    e.preventDefault()
    const d = new Date(form.date)
    addMutation.mutate({ ...form, amount: parseFloat(form.amount), period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear() })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Income</Button>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-36">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString('default', { month: 'long' })}</option>
          ))}
        </Select>
        <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-green-500">{formatCurrency(total)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Period 1 (1–15)</p><p className="text-lg font-semibold">{formatCurrency(p1)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Period 2 (16–end)</p><p className="text-lg font-semibold">{formatCurrency(p2)}</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No income recorded for this period.</p>}
        {entries.map(e => (
          <Card key={e.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{e.source}</p>
                <div className="flex gap-2 mt-0.5">
                  <Badge variant="success">{e.type}</Badge>
                  <span className="text-xs text-muted-foreground">{e.date} · P{e.period}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-green-500">{formatCurrency(e.amount)}</span>
                <button onClick={() => delMutation.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Income">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5"><Label>Source</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{INCOME_TYPES.map(t => <option key={t}>{t}</option>)}</Select></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
