import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLoans, createLoan, updateLoan, deleteLoan, addLoanPayment, settleLoan } from '@/api/loans'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Pencil } from 'lucide-react'

const EMPTY_FORM = { person_id: '', direction: 'borrowed', principal: '', interest_rate: '', total_terms: '', start_date: new Date().toISOString().slice(0, 10), notes: '' }

export default function Loans() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('borrowed')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showPay, setShowPay] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')

  const { data: loans = [] } = useQuery({ queryKey: ['loans'], queryFn: () => getLoans().then(r => r.data) })
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => getPeople().then(r => r.data) })

  const filtered = loans.filter(l => l.direction === tab)
  const activeFiltered = filtered.filter(l => l.status === 'active')
  const settledFiltered = filtered.filter(l => l.status === 'settled')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['loans'] })

  const addMutation = useMutation({ mutationFn: createLoan, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updateLoan(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deleteLoan, onSuccess: invalidate })
  const payMutation = useMutation({
    mutationFn: ({ id, amount, note }) => addLoanPayment(id, { amount: parseFloat(amount), note }),
    onSuccess: () => { invalidate(); setShowPay(null) },
  })
  const settleMutation = useMutation({ mutationFn: (id) => settleLoan(id), onSuccess: invalidate })

  const openEdit = (e, loan) => {
    e.stopPropagation()
    setForm({
      person_id: String(loan.person_id),
      direction: loan.direction,
      principal: String(loan.principal),
      interest_rate: loan.interest_rate ? String(loan.interest_rate) : '',
      total_terms: loan.total_terms ? String(loan.total_terms) : '',
      start_date: loan.start_date,
      notes: loan.notes || '',
    })
    setEditingId(loan.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      person_id: parseInt(form.person_id),
      principal: parseFloat(form.principal),
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
      total_terms: form.total_terms ? parseInt(form.total_terms) : null,
    }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const getPerson = (id) => people.find(p => p.id === id)

  const remaining = (loan) => {
    const paid = loan.payments?.reduce((s, p) => s + parseFloat(p.amount), 0) || 0
    return parseFloat(loan.principal) - paid
  }

  const totalOwed = activeFiltered.reduce((s, l) => s + remaining(l), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Loan
        </Button>
      </div>

      <div className="flex gap-2">
        {['borrowed', 'lent'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {t === 'borrowed' ? 'I Borrowed' : 'I Lent'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Active {tab === 'borrowed' ? 'owed by me' : 'owed to me'}</p>
          <p className="text-2xl font-bold">{formatCurrency(totalOwed)}</p>
        </CardContent>
      </Card>

      {activeFiltered.map(loan => {
        const person = getPerson(loan.person_id)
        const rem = remaining(loan)
        return (
          <Card key={loan.id}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{person?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  <span className="text-foreground font-medium">{formatCurrency(rem)}</span> left of {formatCurrency(loan.principal)}
                  {loan.total_terms ? ` · ${loan.terms_paid}/${loan.total_terms} terms` : ''}
                  {loan.notes ? ` · ${loan.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => { setShowPay(loan.id); setPayAmount(''); setPayNote('') }}>Pay</Button>
                <Button size="sm" variant="secondary" onClick={() => settleMutation.mutate(loan.id)}>Settle</Button>
                <button onClick={e => openEdit(e, loan)} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => delMutation.mutate(loan.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </Card>
        )
      })}

      {settledFiltered.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Settled</h2>
          {settledFiltered.map(loan => (
            <Card key={loan.id} className="opacity-60">
              <CardContent className="py-3 flex justify-between items-center text-sm">
                <span>{getPerson(loan.person_id)?.name} — {formatCurrency(loan.principal)}</span>
                <Badge variant="success">Settled</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Loan' : 'Add Loan'}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="loan-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="loan-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
          <div className="space-y-1.5">
            <Label>Person</Label>
            <Select value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))} required>
              <option value="">Select…</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
              <option value="borrowed">I Borrowed</option>
              <option value="lent">I Lent</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Principal</Label><Input type="number" step="0.01" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} required /></div>
            <div className="space-y-1.5"><Label>Terms (optional)</Label><Input type="number" value={form.total_terms} onChange={e => setForm(f => ({ ...f, total_terms: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
        </form>
      </Modal>

      {/* Pay modal */}
      <Modal open={!!showPay} onClose={() => setShowPay(null)} title="Record Payment"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPay(null)}>Cancel</Button>
            <Button onClick={() => payMutation.mutate({ id: showPay, amount: payAmount, note: payNote })} disabled={payMutation.isPending}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4 pb-1">
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Note</Label><Input value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  )
}
