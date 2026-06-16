import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HelpTip } from '@/components/shared/HelpTip'
import { usePeriod } from '@/contexts/PeriodContext'
import { getIncome, createIncome, updateIncome, deleteIncome } from '@/api/income'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { PersonSelect, personName } from '@/components/shared/PersonSelect'
import { formatCurrency, INCOME_TYPES, getBillingPeriod } from '@/lib/utils'
import { Plus, Trash2, Pencil, CalendarClock } from 'lucide-react'
import { SkeletonList } from '@/components/shared/Loading'
import { PersonAvatars } from '@/components/shared/PersonAvatars'

const now = new Date()
const EMPTY_FORM = { source: '', amount: '', date: now.toISOString().slice(0, 10), type: 'Salary', payable_from: null, due_date: '' }

export default function Income() {
  const qc = useQueryClient()
  const { month, year } = usePeriod()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['income', month, year],
    queryFn: () => getIncome({ month, year }).then(r => r.data),
  })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['income'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const addMutation = useMutation({ mutationFn: createIncome, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updateIncome(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deleteIncome, onSuccess: invalidate })

  const openEdit = (e) => {
    setForm({ source: e.source, amount: String(e.amount), date: e.date, type: e.type, payable_from: e.payable_from ?? null, due_date: e.due_date || '' })
    setEditingId(e.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const d = new Date(form.date)
    const payload = { ...form, amount: parseFloat(form.amount), due_date: form.due_date || null, period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear() }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const total = entries.reduce((s, e) => s + parseFloat(e.amount), 0)
  const p1 = entries.filter(e => e.period === 1).reduce((s, e) => s + parseFloat(e.amount), 0)
  const p2 = entries.filter(e => e.period === 2).reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Income <HelpTip text="Record what you earn each month, by source." /></h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Income
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">Total</p><p className="text-base sm:text-xl font-bold text-green-500 tabular-nums break-words leading-tight">{formatCurrency(total)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">1st–15th</p><p className="text-sm sm:text-lg font-semibold tabular-nums break-words leading-tight">{formatCurrency(p1)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">16th–end</p><p className="text-sm sm:text-lg font-semibold tabular-nums break-words leading-tight">{formatCurrency(p2)}</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {isLoading && <Card><CardContent className="py-2"><SkeletonList rows={3} /></CardContent></Card>}
        {!isLoading && entries.length === 0 && <p className="text-sm text-muted-foreground">No income recorded for this period.</p>}
        {entries.map(e => (
          <Card key={e.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{e.source}</span>
                  {e.payable_from != null && <PersonAvatars ids={[e.payable_from]} people={people} roles={{ [e.payable_from]: 'income from' }} title="From" />}
                </p>
                <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                  <Badge variant="success">{e.type}</Badge>
                  <span className="text-xs text-muted-foreground">{e.date}</span>
                </div>
                {(e.payable_from || e.due_date) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted-foreground">
                    <CalendarClock className="w-3 h-3 shrink-0" />
                    {e.payable_from ? <span>from {personName(people, e.payable_from)}</span> : null}
                    {e.due_date ? <span>· due {e.due_date}</span> : null}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-500">{formatCurrency(e.amount)}</span>
                <button onClick={() => openEdit(e)} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => delMutation.mutate(e.id)} className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Income' : 'Add Income'}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="income-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="income-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
          <div className="space-y-1.5"><Label>Source</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
          <div className="space-y-1.5"><Label>Transaction date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{INCOME_TYPES.map(t => <option key={t}>{t}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Payable from <span className="text-muted-foreground text-xs">(who pays you — optional)</span></Label><PersonSelect value={form.payable_from} onChange={v => setForm(f => ({ ...f, payable_from: v }))} people={people} /></div>
          <div className="space-y-1.5"><Label>Due date <span className="text-muted-foreground text-xs">(when expected — optional)</span></Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
        </form>
      </Modal>
    </div>
  )
}
