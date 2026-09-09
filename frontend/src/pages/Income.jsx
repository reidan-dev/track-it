import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HelpTip } from '@/components/shared/HelpTip'
import { usePeriod } from '@/contexts/PeriodContext'
import { getIncome, createIncome, updateIncome, deleteIncome, receiveIncome, unreceiveIncome } from '@/api/income'
import { getPeople } from '@/api/people'
import { Card, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { Badge } from '@/components/shared/Badge'
import { Modal } from '@/components/shared/Modal'
import { PersonSelect, personName } from '@/components/shared/PersonSelect'
import { ParticipantsEditor, ParticipantsBadge, ME_ID } from '@/components/shared/ParticipantsEditor'
import { useDeductions, deductionsFor } from '@/lib/deductions'
import { DeductionsPanel } from '@/components/shared/DeductionsPanel'
import { formatCurrency, INCOME_TYPES, getBillingPeriod, cn } from '@/lib/utils'
import { Plus, Trash2, Pencil, CalendarClock, Repeat, Check, X } from 'lucide-react'
import { SkeletonList } from '@/components/shared/Loading'
import { PersonAvatars } from '@/components/shared/PersonAvatars'

const now = new Date()
const EMPTY_FORM = {
  source: '', amount: '', date: now.toISOString().slice(0, 10), type: 'Salary', payable_from: null, due_date: '',
  earned_by: null, participants: [], participant_amounts: {},
  is_recurring: false, end_month: '', end_year: '',
}

// A recurring template's "receipt" for the viewed month, if it's been marked received.
const receiptFor = (e, month, year) => (e.receipts || []).find(r => r.month === month && r.year === year)
const isReceived = (e, month, year) => !!receiptFor(e, month, year)
const resolvedAmount = (e, month, year) => {
  const r = receiptFor(e, month, year)
  if (!r) return null
  return r.amount_received != null ? parseFloat(r.amount_received) : parseFloat(e.amount)
}

function RecurringIncomeRow({ entry, month, year, people, allDeductions, onEdit }) {
  const qc = useQueryClient()
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [period, setPeriod] = useState(entry.period || 1)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['income'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const receiveMutation = useMutation({
    mutationFn: ({ amount }) => receiveIncome(entry.id, month, year, { period, amount }),
    onSuccess: () => { invalidate(); setEditingAmount(false) },
  })
  const unreceiveMutation = useMutation({
    mutationFn: () => unreceiveIncome(entry.id, month, year),
    onSuccess: invalidate,
  })
  const delMutation = useMutation({
    mutationFn: () => deleteIncome(entry.id),
    onSuccess: invalidate,
  })

  const received = isReceived(entry, month, year)
  const amount = resolvedAmount(entry, month, year)
  const deductions = deductionsFor(allDeductions, 'income', entry.id)

  const startEdit = () => {
    const r = receiptFor(entry, month, year)
    if (r) setPeriod(r.period)
    setAmountInput(String(amount ?? entry.amount))
    setEditingAmount(true)
  }
  const confirmEdit = (e) => {
    e.preventDefault()
    const v = parseFloat(amountInput)
    receiveMutation.mutate({ amount: isNaN(v) ? undefined : v })
  }

  return (
    <Card key={entry.id}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm flex items-center gap-1.5 min-w-0">
              <span className="truncate">{entry.source}</span>
              <Repeat className="w-3 h-3 text-muted-foreground shrink-0" />
              {entry.earned_by != null && entry.earned_by !== ME_ID && <PersonAvatars ids={[entry.earned_by]} people={people} roles={{ [entry.earned_by]: 'earned by' }} title="Earned by" />}
            </p>
            <div className="flex gap-2 mt-0.5 flex-wrap items-center">
              <Badge variant="success">{entry.type}</Badge>
              <span className="text-xs text-muted-foreground">recurring · default {formatCurrency(entry.amount)}</span>
            </div>
            {entry.participants?.length > 0 && (
              <ParticipantsBadge participants={entry.participants} participantAmounts={entry.participant_amounts} people={people} totalAmount={amount ?? entry.amount} />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {received ? (
              <>
                <button onClick={startEdit} className="text-sm font-semibold text-green-500 hover:underline">
                  {formatCurrency(amount)}
                </button>
                <button onClick={() => unreceiveMutation.mutate()} title="Unmark received"
                  className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => receiveMutation.mutate({})} disabled={receiveMutation.isPending}>
                <Check className="w-3.5 h-3.5 mr-1" />Mark received
              </Button>
            )}
            <button onClick={() => onEdit(entry)} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => delMutation.mutate()} className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-accent">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {editingAmount && (
          <form onSubmit={confirmEdit} className="flex items-center gap-1.5 mt-2">
            <Select value={period} onChange={e => setPeriod(parseInt(e.target.value))} className="h-8 text-xs w-28">
              <option value={1}>1st–15th</option>
              <option value={2}>16th–end</option>
            </Select>
            <Input type="number" step="0.01" min="0" value={amountInput} onChange={e => setAmountInput(e.target.value)}
              className="h-8 text-xs w-28" autoFocus />
            <Button size="sm" type="submit" disabled={receiveMutation.isPending}>Save</Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setEditingAmount(false)}>Cancel</Button>
          </form>
        )}

        {entry.amount != null && (
          <div className="mt-2">
            <DeductionsPanel
              itemType="income"
              itemId={entry.id}
              amount={amount ?? entry.amount}
              participants={entry.participants}
              people={people}
              month={month}
              year={year}
              deductions={deductions}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
  const allDeductions = useDeductions(month, year)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['income'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const addMutation = useMutation({ mutationFn: createIncome, onSuccess: () => { invalidate(); closeForm() } })
  const editMutation = useMutation({ mutationFn: ({ id, data }) => updateIncome(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const delMutation = useMutation({ mutationFn: deleteIncome, onSuccess: invalidate })

  const openEdit = (e) => {
    setForm({
      source: e.source, amount: String(e.amount), date: e.date, type: e.type, payable_from: e.payable_from ?? null, due_date: e.due_date || '',
      earned_by: e.earned_by ?? null, participants: e.participants || [], participant_amounts: e.participant_amounts || {},
      is_recurring: !!e.is_recurring, end_month: e.end_month ?? '', end_year: e.end_year ?? '',
    })
    setEditingId(e.id)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const { end_month, end_year, ...rest } = form
    const commonEnd = { end_month: end_month ? parseInt(end_month) : null, end_year: end_year ? parseInt(end_year) : null }
    let payload
    if (form.is_recurring) {
      // A template has no single transaction date — pin it to the currently
      // viewed period; actual occurrences are recorded via receipts instead.
      payload = { ...rest, ...commonEnd, due_date: null, date: `${year}-${String(month).padStart(2, '0')}-01`, period: 1, month, year, start_month: month, start_year: year }
    } else {
      const d = new Date(form.date)
      payload = { ...rest, ...commonEnd, due_date: form.due_date || null, period: getBillingPeriod(d.getDate()), month: d.getMonth() + 1, year: d.getFullYear() }
    }
    if (editingId) editMutation.mutate({ id: editingId, data: payload })
    else addMutation.mutate(payload)
  }

  const recurring = entries.filter(e => e.is_recurring)
  const oneOff = entries.filter(e => !e.is_recurring)

  // Only entries that actually count this month feed the stat cards: one-off
  // entries always do; recurring templates only once marked received.
  const counted = [
    ...oneOff.map(e => ({ amount: parseFloat(e.amount), period: e.period })),
    ...recurring.filter(e => isReceived(e, month, year)).map(e => ({
      amount: resolvedAmount(e, month, year), period: receiptFor(e, month, year).period,
    })),
  ]
  const total = counted.reduce((s, e) => s + e.amount, 0)
  const p1 = counted.filter(e => e.period === 1).reduce((s, e) => s + e.amount, 0)
  const p2 = counted.filter(e => e.period === 2).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Income <HelpTip text="Record what you earn each month, by source. Recurring incomes repeat automatically but only count once marked received." /></h1>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
          <Plus className="w-4 h-4 mr-2" />Add Income
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">Total</p><p className="text-base sm:text-xl font-bold text-green-500 tabular-nums break-words leading-tight">{formatCurrency(total)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">1st–15th</p><p className="text-sm sm:text-lg font-semibold tabular-nums break-words leading-tight">{formatCurrency(p1)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 min-w-0"><p className="text-xs text-muted-foreground truncate">16th–end</p><p className="text-sm sm:text-lg font-semibold tabular-nums break-words leading-tight">{formatCurrency(p2)}</p></CardContent></Card>
      </div>

      {isLoading && <Card><CardContent className="py-2"><SkeletonList rows={3} /></CardContent></Card>}

      {!isLoading && recurring.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recurring</h2>
          {recurring.map(e => (
            <RecurringIncomeRow key={e.id} entry={e} month={month} year={year} people={people} allDeductions={allDeductions} onEdit={openEdit} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {!isLoading && recurring.length > 0 && oneOff.length > 0 && (
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">One-off</h2>
        )}
        {!isLoading && entries.length === 0 && <p className="text-sm text-muted-foreground">No income recorded for this period.</p>}
        {oneOff.map(e => {
          const deductions = deductionsFor(allDeductions, 'income', e.id)
          return (
          <Card key={e.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{e.source}</span>
                    {e.payable_from != null && <PersonAvatars ids={[e.payable_from]} people={people} roles={{ [e.payable_from]: 'income from' }} title="From" />}
                    {e.earned_by != null && e.earned_by !== ME_ID && <PersonAvatars ids={[e.earned_by]} people={people} roles={{ [e.earned_by]: 'earned by' }} title="Earned by" />}
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
                  {e.participants?.length > 0 && (
                    <ParticipantsBadge participants={e.participants} participantAmounts={e.participant_amounts} people={people} totalAmount={e.amount} />
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
              </div>
              <div className="mt-2">
                <DeductionsPanel
                  itemType="income"
                  itemId={e.id}
                  amount={e.amount}
                  participants={e.participants}
                  people={people}
                  month={e.month}
                  year={e.year}
                  deductions={deductions}
                />
              </div>
            </CardContent>
          </Card>
        )})}
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
          <div className="space-y-1.5">
            <Label>Amount {form.is_recurring && <span className="text-muted-foreground text-xs">(default — editable per month)</span>}</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>

          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
              {[{ key: false, label: 'One-off' }, { key: true, label: 'Recurring' }].map(opt => (
                <button key={String(opt.key)} type="button"
                  onClick={() => setForm(f => ({ ...f, is_recurring: opt.key }))}
                  className={cn('h-9 rounded-md text-sm font-medium transition-colors',
                    form.is_recurring === opt.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.is_recurring ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ends <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" min="1" max="12" placeholder="Month" value={form.end_month} onChange={e => setForm(f => ({ ...f, end_month: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>&nbsp;</Label>
                <Input type="number" placeholder="Year" value={form.end_year} onChange={e => setForm(f => ({ ...f, end_year: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5"><Label>Transaction date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          )}

          <div className="space-y-1.5"><Label>Type</Label><Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{INCOME_TYPES.map(t => <option key={t}>{t}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Payable from <span className="text-muted-foreground text-xs">(who pays you each occurrence — optional)</span></Label><PersonSelect value={form.payable_from} onChange={v => setForm(f => ({ ...f, payable_from: v }))} people={people} /></div>
          {!form.is_recurring && (
            <div className="space-y-1.5"><Label>Due date <span className="text-muted-foreground text-xs">(when expected — optional)</span></Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          )}
          <div className="space-y-1.5"><Label>Earned by <span className="text-muted-foreground text-xs">(who this income actually came from — optional, for reference only)</span></Label><PersonSelect value={form.earned_by} onChange={v => setForm(f => ({ ...f, earned_by: v }))} people={people} /></div>
          <div className="space-y-1.5">
            <Label>Share with <span className="text-muted-foreground text-xs">(splits this income — each person's share shows as a credit in Summary and lowers your net cash)</span></Label>
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
