import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { Input, Label, Select } from '@/components/shared/Input'
import { PaymentMethodSelect } from '@/components/shared/PaymentMethodSelect'
import { ReceiptCapture } from '@/components/shared/ReceiptCapture'
import { createExpense } from '@/api/expenses'
import { createIncome } from '@/api/income'
import { ME_ID } from '@/components/shared/ParticipantsEditor'
import { EXPENSE_CATEGORIES, INCOME_TYPES, getBillingPeriod, CURRENCY_SYMBOLS } from '@/lib/utils'
import { cn } from '@/lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Fast amount-first capture sheet. Defaults to Expense; toggle to Income.
 * Designed to log something in as few taps as possible from the FAB.
 */
export function QuickAddSheet({ open, onClose, defaultType = 'expense' }) {
  const qc = useQueryClient()
  const currency = qc.getQueryData(['settings'])?.currency || 'PHP'
  const symbol = CURRENCY_SYMBOLS[currency] || ''
  const amountRef = useRef(null)

  const [type, setType] = useState(defaultType)
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Food')
  const [incomeType, setIncomeType] = useState('Salary')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [date, setDate] = useState(today())
  const [receipt, setReceipt] = useState(null)

  const reset = () => {
    setType(defaultType); setAmount(''); setName(''); setCategory('Food')
    setIncomeType('Salary'); setPaymentMethod(''); setDate(today()); setReceipt(null)
  }

  // Fresh state + focus amount each time it opens.
  useEffect(() => {
    if (open) {
      reset()
      const t = setTimeout(() => amountRef.current?.focus(), 250)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { onClose(); }

  const mutation = useMutation({
    mutationFn: (payload) => (type === 'expense' ? createExpense(payload) : createIncome(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['income'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
      close()
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) return
    const d = new Date(date)
    const base = {
      amount: value,
      date,
      period: getBillingPeriod(d.getDate()),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    }
    const payload = type === 'expense'
      ? { ...base, name, category, note: '', payment_method: paymentMethod, participants: [ME_ID], participant_amounts: {}, receipt_image: receipt }
      : { ...base, source: name || incomeType, type: incomeType }
    mutation.mutate(payload)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Quick add"
      footer={
        <Button type="submit" form="quick-add-form" className="w-full h-11"
          disabled={mutation.isPending || !amount}>
          {mutation.isPending ? 'Saving…' : `Add ${type === 'expense' ? 'expense' : 'income'}`}
        </Button>
      }
    >
      <form id="quick-add-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
          {['expense', 'income'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'h-9 rounded-md text-sm font-medium capitalize transition-colors',
                type === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Big amount-first input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground pointer-events-none">{symbol}</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full h-16 rounded-xl border border-input bg-background pl-10 pr-4 text-3xl font-bold tabular-nums text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{type === 'expense' ? 'Name (optional)' : 'Source'}</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'expense' ? 'e.g. Lunch' : 'e.g. Paycheck'}
          />
        </div>

        {type === 'expense' ? (
          <>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      category === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
            <div className="space-y-1.5">
              <Label>Receipt <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <ReceiptCapture value={receipt} onChange={setReceipt} />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={incomeType} onChange={e => setIncomeType(e.target.value)}>
              {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
      </form>
    </Modal>
  )
}
