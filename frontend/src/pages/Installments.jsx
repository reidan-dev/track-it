import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInstallments, createInstallment, updateInstallment, deleteInstallment, payInstallment, unpayInstallment, settleInstallmentParticipant, unsettleInstallmentParticipant } from '@/api/installments'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select, Textarea } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, getBillingPeriod } from '@/lib/utils'
import { PaymentMethodSelect, PaymentMethodBadge } from '@/components/shared/PaymentMethodSelect'
import { ParticipantsEditor, ME_ID } from '@/components/shared/ParticipantsEditor'
import { SplitTracker } from '@/components/shared/SplitTracker'
import { Plus, Trash2, CheckCircle, Circle, Pencil, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const now = new Date()

const EMPTY_FORM = {
  name: '',
  loaned_amount: '',
  installment_amount: '',
  total_terms: '',
  terms_paid: '0',
  start_month: now.getMonth() + 1,
  start_year: now.getFullYear(),
  due_day: '',
  due_day_1: '',
  due_day_2: '',
  frequency: 'monthly',
  participants: [ME_ID],
  participant_amounts: {},
  payment_method: '',
  notes: '',
}

function PeriodBadge({ due_day }) {
  if (!due_day) return null
  const period = getBillingPeriod(parseInt(due_day))
  return (
    <Badge variant={period === 1 ? 'default' : 'warning'}>
      Period {period} (due {due_day}{ordinal(due_day)})
    </Badge>
  )
}

function ordinal(n) {
  const num = parseInt(n)
  if (num >= 11 && num <= 13) return 'th'
  switch (num % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}


export default function Installments() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [openIds, setOpenIds] = useState({})
  const toggleOpen = (id) => setOpenIds(o => ({ ...o, [id]: !o[id] }))

  const { data: installments = [] } = useQuery({
    queryKey: ['installments'],
    queryFn: () => getInstallments().then(r => r.data),
  })
  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => getPeople().then(r => r.data),
  })

  const M = now.getMonth() + 1
  const Y = now.getFullYear()

  const isPaidPeriod = (inst, period) =>
    inst.payments?.some(p => p.month === M && p.year === Y && p.period === period)

  const isPaidMonthly = (inst) =>
    inst.payments?.some(p => p.month === M && p.year === Y && p.period == null)

  const isFullyPaidThisMonth = (inst) =>
    inst.frequency === 'biweekly'
      ? isPaidPeriod(inst, 1) && isPaidPeriod(inst, 2)
      : isPaidMonthly(inst)

  const active = [...installments.filter(i => i.status === 'active')]
    .sort((a, b) => Number(isFullyPaidThisMonth(a)) - Number(isFullyPaidThisMonth(b)))
  const completed = installments.filter(i => i.status === 'completed')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['installments'] })

  const addMutation = useMutation({ mutationFn: createInstallment, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updateInstallment(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deleteInstallment, onSuccess: invalidate })
  const payMutation = useMutation({
    mutationFn: ({ id, period = null }) => payInstallment(id, M, Y, period),
    onSuccess: invalidate,
  })

  const unpayMutation = useMutation({
    mutationFn: ({ id, period = null }) => unpayInstallment(id, M, Y, period),
    onSuccess: invalidate,
  })

  const settleMutation = useMutation({
    mutationFn: ({ id, personId, period, settled }) =>
      settled
        ? unsettleInstallmentParticipant(id, personId, M, Y, period)
        : settleInstallmentParticipant(id, personId, M, Y, period),
    onSuccess: invalidate,
  })

  const openEdit = (e, inst) => {
    e.stopPropagation()
    const [d1, d2] = (inst.due_day ? String(inst.due_day).split(',') : []).map(s => s.trim())
    setForm({
      name: inst.name,
      loaned_amount: inst.loaned_amount != null ? String(inst.loaned_amount) : '',
      installment_amount: String(inst.installment_amount),
      total_terms: String(inst.total_terms),
      terms_paid: String(inst.terms_paid),
      start_month: inst.start_month,
      start_year: inst.start_year,
      due_day: inst.due_day ? String(inst.due_day) : '',
      due_day_1: inst.frequency === 'biweekly' ? (d1 || '') : '',
      due_day_2: inst.frequency === 'biweekly' ? (d2 || '') : '',
      frequency: inst.frequency || 'monthly',
      participants: inst.participants?.length ? inst.participants : [ME_ID],
      participant_amounts: inst.participant_amounts || {},
      payment_method: inst.payment_method || '',
      notes: inst.notes || '',
    })
    setEditingId(inst.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const { due_day_1, due_day_2, ...rest } = form
    const due_day = form.frequency === 'biweekly'
      ? ([due_day_1, due_day_2].filter(d => d !== '' && d != null).map(d => String(d).trim()).join(', ') || null)
      : (form.due_day || null)
    const payload = {
      ...rest,
      loaned_amount: form.loaned_amount !== '' ? parseFloat(form.loaned_amount) : null,
      installment_amount: parseFloat(form.installment_amount),
      total_terms: parseInt(form.total_terms),
      terms_paid: parseInt(form.terms_paid) || 0,
      due_day,
    }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const totalObligation = active.reduce((s, i) => s + parseFloat(i.installment_amount) * (i.frequency === 'biweekly' ? 2 : 1), 0)

  const InstallmentCard = ({ inst, open, onToggleOpen }) => {
    const biweekly = inst.frequency === 'biweekly'
    const fullyPaid = isFullyPaidThisMonth(inst)
    const completed = inst.status === 'completed'
    const totalAmount = inst.total_amount ?? (inst.total_terms * parseFloat(inst.installment_amount))
    const remaining = (inst.total_terms - inst.terms_paid) * parseFloat(inst.installment_amount)
    const period = inst.due_day ? getBillingPeriod(inst.due_day) : null
    const hasSplit = (inst.participants?.length || 0) > 1
    const statusLabel = completed ? 'Done' : fullyPaid ? 'Paid' : biweekly ? `${[1,2].filter(p=>isPaidPeriod(inst,p)).length}/2 paid` : 'Unpaid'

    return (
      <Card>
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            {/* Pay toggle(s) */}
            {completed ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            ) : biweekly ? (
              <div className="flex gap-1.5 shrink-0">
                {[1, 2].map(p => {
                  const pPaid = isPaidPeriod(inst, p)
                  return (
                    <button key={p}
                      onClick={() => pPaid
                        ? unpayMutation.mutate({ id: inst.id, period: p })
                        : payMutation.mutate({ id: inst.id, period: p })
                      }
                      title={pPaid ? `Undo Period ${p}` : `Pay Period ${p}`}
                      className={cn('flex flex-col items-center gap-0.5 text-[10px] transition-colors',
                        pPaid ? 'text-green-500 hover:text-red-400' : 'text-muted-foreground hover:text-primary')}>
                      {pPaid ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      P{p}
                    </button>
                  )
                })}
              </div>
            ) : (
              <button
                onClick={() => fullyPaid
                  ? unpayMutation.mutate({ id: inst.id })
                  : payMutation.mutate({ id: inst.id })
                }
                title={fullyPaid ? 'Mark unpaid' : 'Mark paid'}
                className={cn('shrink-0 transition-colors', fullyPaid ? 'text-green-500 hover:text-red-400' : 'text-muted-foreground hover:text-primary')}
              >
                {fullyPaid ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </button>
            )}

            {/* Name + progress summary */}
            <button onClick={onToggleOpen} className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm truncate">{inst.name}</span>
                {hasSplit && <Users className="w-3 h-3 text-muted-foreground shrink-0" />}
                {biweekly
                  ? <Badge variant="warning" className="text-[10px]">biweekly</Badge>
                  : period && <Badge variant={period === 1 ? 'default' : 'warning'} className="text-[10px]">P{period}</Badge>
                }
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {inst.terms_paid}/{inst.total_terms} terms · {formatCurrency(remaining)} left
              </p>
            </button>

            {/* Per-term amount */}
            <div className="text-right shrink-0">
              <span className="text-sm font-semibold block">{formatCurrency(inst.installment_amount)}</span>
              <span className="text-[10px] text-muted-foreground">/term</span>
            </div>

            <button onClick={onToggleOpen} className="shrink-0 text-muted-foreground hover:text-foreground">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <ProgressBar value={inst.terms_paid} max={inst.total_terms} className="mt-2" />
        </div>

        {open && (
          <div className="border-t border-border px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Total <span className="text-foreground font-medium">{formatCurrency(totalAmount)}</span></span>
              {inst.loaned_amount != null && (
                <span>Loaned <span className="text-foreground font-medium">{formatCurrency(inst.loaned_amount)}</span></span>
              )}
              {inst.due_day && (
                <span>due {biweekly ? String(inst.due_day) : `${inst.due_day}${ordinal(inst.due_day)}`}</span>
              )}
              <Badge variant={completed || fullyPaid ? 'success' : 'warning'} className="text-[10px]">{statusLabel}</Badge>
              {inst.payment_method && <PaymentMethodBadge value={inst.payment_method} />}
            </div>
            {inst.notes && <p className="text-xs text-muted-foreground">{inst.notes}</p>}
            <SplitTracker
              entry={inst}
              amount={inst.installment_amount}
              people={people}
              month={M}
              year={Y}
              onToggle={(personId, period, settled) => settleMutation.mutate({ id: inst.id, personId, period, settled })}
            />
            <div className="flex justify-end gap-1.5 pt-0.5">
              <button onClick={e => openEdit(e, inst)} className="flex items-center gap-1 text-xs px-2 py-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent"><Pencil className="w-3.5 h-3.5" />Edit</button>
              <button onClick={() => delMutation.mutate(inst.id)} className="flex items-center gap-1 text-xs px-2 py-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent"><Trash2 className="w-3.5 h-3.5" />Delete</button>
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Installments</h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Total obligations this month</p>
          <p className="text-2xl font-bold">{formatCurrency(totalObligation)}</p>
        </CardContent>
      </Card>

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          {active.map(i => <InstallmentCard key={i.id} inst={i} open={!!openIds[i.id]} onToggleOpen={() => toggleOpen(i.id)} />)}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
          {completed.map(i => <InstallmentCard key={i.id} inst={i} open={!!openIds[i.id]} onToggleOpen={() => toggleOpen(i.id)} />)}
        </div>
      )}

      {installments.length === 0 && <p className="text-sm text-muted-foreground">No installments yet.</p>}

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Edit Installment' : 'Add Installment'} className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" form="installment-form" disabled={addMutation.isPending || editMutation.isPending}>
              {editingId ? 'Save changes' : 'Add'}
            </Button>
          </div>
        }
      >
        <form id="installment-form" onSubmit={handleSubmit} className="space-y-4 pb-1">

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loaned Amount <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="number" step="0.01" min="0" value={form.loaned_amount} onChange={e => setForm(f => ({ ...f, loaned_amount: e.target.value }))} placeholder="e.g. 50000" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount per Term</Label>
              <Input type="number" step="0.01" value={form.installment_amount} onChange={e => setForm(f => ({ ...f, installment_amount: e.target.value }))} required />
            </div>
          </div>

          {form.installment_amount && form.total_terms && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-foreground ml-auto">
                {formatCurrency(parseFloat(form.installment_amount || 0) * parseInt(form.total_terms || 0))}
              </span>
              <span className="text-xs text-muted-foreground">
                ({form.total_terms} × {formatCurrency(form.installment_amount)})
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              <option value="monthly">Monthly (once/month)</option>
              <option value="biweekly">Biweekly (P1 + P2 each month)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total Terms</Label>
              <Input type="number" min="1" value={form.total_terms} onChange={e => setForm(f => ({ ...f, total_terms: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Terms Already Paid</Label>
              <Input type="number" min="0" value={form.terms_paid} onChange={e => setForm(f => ({ ...f, terms_paid: e.target.value }))} />
            </div>
          </div>

          {/* Due day(s) */}
          {form.frequency === 'biweekly' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>P1 Due Day <span className="text-muted-foreground text-xs">(1–15)</span></Label>
                <Input type="number" min="1" max="15" value={form.due_day_1} onChange={e => setForm(f => ({ ...f, due_day_1: e.target.value }))} placeholder="e.g. 5" />
              </div>
              <div className="space-y-1.5">
                <Label>P2 Due Day <span className="text-muted-foreground text-xs">(16–31)</span></Label>
                <Input type="number" min="16" max="31" value={form.due_day_2} onChange={e => setForm(f => ({ ...f, due_day_2: e.target.value }))} placeholder="e.g. 20" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Due Day (1–31)</Label>
              <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="e.g. 10" />
              {form.due_day && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <PeriodBadge due_day={form.due_day} />
                  <span className="text-muted-foreground">
                    — shows in {getBillingPeriod(parseInt(form.due_day)) === 1 ? '1st–15th' : '16th–end'} view
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Participants & Split</Label>
            <ParticipantsEditor
              participants={form.participants}
              participantAmounts={form.participant_amounts}
              onParticipantsChange={v => setForm(f => ({ ...f, participants: v }))}
              onAmountsChange={v => setForm(f => ({ ...f, participant_amounts: v }))}
              people={people}
              totalAmount={form.installment_amount}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <PaymentMethodSelect value={form.payment_method} onChange={v => setForm(f => ({ ...f, payment_method: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

        </form>
      </Modal>
    </div>
  )
}
