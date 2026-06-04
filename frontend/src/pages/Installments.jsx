import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInstallments, createInstallment, deleteInstallment, payInstallment } from '@/api/installments'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, CheckCircle } from 'lucide-react'

const now = new Date()

export default function Installments() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', total_amount: '', installment_amount: '', total_terms: '', start_month: now.getMonth() + 1, start_year: now.getFullYear(), notes: '' })

  const { data: installments = [] } = useQuery({
    queryKey: ['installments'],
    queryFn: () => getInstallments().then(r => r.data),
  })

  const active = installments.filter(i => i.status === 'active')
  const completed = installments.filter(i => i.status === 'completed')

  const addMutation = useMutation({
    mutationFn: createInstallment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['installments'] }); setShowAdd(false) },
  })

  const delMutation = useMutation({
    mutationFn: deleteInstallment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installments'] }),
  })

  const payMutation = useMutation({
    mutationFn: ({ id }) => payInstallment(id, now.getMonth() + 1, now.getFullYear()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installments'] }),
  })

  const isPaidThisMonth = (inst) =>
    inst.payments?.some(p => p.month === now.getMonth() + 1 && p.year === now.getFullYear())

  const totalObligation = active.reduce((s, i) => s + parseFloat(i.installment_amount), 0)

  const handleAdd = (e) => {
    e.preventDefault()
    addMutation.mutate({ ...form, total_amount: parseFloat(form.total_amount), installment_amount: parseFloat(form.installment_amount), total_terms: parseInt(form.total_terms) })
  }

  const InstallmentCard = ({ inst }) => {
    const paid = isPaidThisMonth(inst)
    const remaining = (inst.total_terms - inst.terms_paid) * parseFloat(inst.installment_amount)
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium">{inst.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {inst.terms_paid} / {inst.total_terms} paid — {formatCurrency(remaining)} remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inst.status === 'active' && (
                <button
                  onClick={() => !paid && payMutation.mutate({ id: inst.id })}
                  disabled={paid}
                  className={paid ? 'text-green-500' : 'text-muted-foreground hover:text-primary'}
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => delMutation.mutate(inst.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <ProgressBar value={inst.terms_paid} max={inst.total_terms} />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatCurrency(inst.installment_amount)}/month</span>
            <Badge variant={inst.status === 'completed' ? 'success' : paid ? 'success' : 'warning'}>
              {inst.status === 'completed' ? 'Done' : paid ? 'Paid this month' : 'Unpaid'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Installments</h1>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add</Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Total obligations this month</p>
          <p className="text-2xl font-bold">{formatCurrency(totalObligation)}</p>
        </CardContent>
      </Card>

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          {active.map(i => <InstallmentCard key={i.id} inst={i} />)}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
          {completed.map(i => <InstallmentCard key={i.id} inst={i} />)}
        </div>
      )}

      {installments.length === 0 && <p className="text-sm text-muted-foreground">No installments yet.</p>}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Installment">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Total Amount</Label><Input type="number" step="0.01" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} required /></div>
            <div className="space-y-1.5"><Label>Per Term</Label><Input type="number" step="0.01" value={form.installment_amount} onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))} required /></div>
          </div>
          <div className="space-y-1.5"><Label>Total Terms</Label><Input type="number" min="1" value={form.total_terms} onChange={e => setForm(f => ({ ...f, total_terms: e.target.value }))} required /></div>
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
