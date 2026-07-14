import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { usePeriod } from '@/contexts/PeriodContext'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardSummary, settleUp } from '@/api/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ChevronDown, ChevronUp, ImageDown, Download, HandCoins, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PullToRefresh } from '@/components/shared/PullToRefresh'
import { useMonthSwipe } from '@/hooks/useMonthSwipe'
import { LoadingState } from '@/components/shared/Loading'

const SOURCE_LABELS = { loan: 'Loan', bill: 'Bill', installment: 'Installment', expense: 'Expense' }

// ── Render selected balances to a PNG canvas (for clipboard/export) ──────────
const IMG_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function sourceDesc(s) {
  const type = SOURCE_LABELS[s.type] || s.type
  if (s.type === 'installment' && s.total_terms != null) {
    return `${type} ( ${s.term} / ${s.total_terms} ) · ${s.label}`
  }
  const name = s.label && s.label !== type ? ` · ${s.label}` : ''
  return `${type}${name}`
}

function renderBalancesImage(rows, monthLabel) {
  const scale = Math.max(2, window.devicePixelRatio || 1)
  const fmt = (v) => formatCurrency(v)
  const signed = (amt, positive) => `${positive ? '' : '−'}${fmt(Math.abs(amt))}`
  const padX = 24, titleH = 56, personH = 32, itemH = 24, totalRowH = 30, gap = 12, botPad = 18
  const contentW = 520
  const W = padX * 2 + contentW
  const amountX = W - padX
  const itemX = padX + 16
  const descMaxW = amountX - itemX - 100

  let bodyH = 0
  rows.forEach(r => { bodyH += personH + (r.sources?.length || 0) * itemH + totalRowH + gap })
  const H = titleH + bodyH + botPad

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left'; ctx.font = `700 22px ${IMG_FONT}`
  ctx.fillText(`Balances · ${monthLabel}`, padX, titleH / 2 + 2)
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(padX, titleH); ctx.lineTo(W - padX, titleH); ctx.stroke()

  let y = titleH
  rows.forEach((r, idx) => {
    // Person name
    ctx.textAlign = 'left'; ctx.font = `600 16px ${IMG_FONT}`; ctx.fillStyle = '#0f172a'
    ctx.fillText(fitText(ctx, r.nickname || r.name, contentW - 40), padX, y + personH / 2)
    y += personH

    // Per-item lines
    ;(r.sources || []).forEach(s => {
      const iy = y + itemH / 2
      const owed = s.direction === 'owed_to_me'
      ctx.textAlign = 'left'; ctx.font = `400 12px ${IMG_FONT}`; ctx.fillStyle = '#64748b'
      ctx.fillText(fitText(ctx, sourceDesc(s), descMaxW), itemX, iy)
      ctx.textAlign = 'right'; ctx.font = `400 12px ${IMG_FONT}`; ctx.fillStyle = owed ? '#16a34a' : '#dc2626'
      ctx.fillText(signed(s.amount, owed), amountX, iy)
      y += itemH
    })

    // Per-person total (labeled)
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(itemX, y); ctx.lineTo(W - padX, y); ctx.stroke()
    const ty = y + totalRowH / 2
    ctx.textAlign = 'left'; ctx.font = `700 12px ${IMG_FONT}`; ctx.fillStyle = '#475569'
    ctx.fillText('TOTAL', itemX, ty)
    ctx.textAlign = 'right'; ctx.font = `700 17px ${IMG_FONT}`; ctx.fillStyle = r.net >= 0 ? '#16a34a' : '#dc2626'
    ctx.fillText(signed(r.net, r.net >= 0), amountX, ty)
    y += totalRowH

    // Divider between people
    if (idx < rows.length - 1) {
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padX, y + gap / 2); ctx.lineTo(W - padX, y + gap / 2); ctx.stroke()
    }
    y += gap
  })

  return canvas
}

function PersonAvatar({ person }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
      style={{ backgroundColor: person.color || '#64748b' }}
    >
      {person.emoji || (person.nickname || person.name).charAt(0).toUpperCase()}
    </div>
  )
}

function PersonBalanceRow({ person, onSettle }) {
  const [open, setOpen] = useState(false)
  const displayName = person.nickname || person.name
  const net = person.net
  const positive = net >= 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <PersonAvatar person={person} />
          <div className="min-w-0">
            <span className="font-medium text-sm block truncate">{displayName}</span>
            <span className="text-[11px] text-muted-foreground">
              {positive ? 'owes me' : 'I owe'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-sm font-semibold', positive ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
            {positive ? '' : '−'}{formatCurrency(Math.abs(net))}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && person.sources?.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-2.5 py-2 space-y-1.5">
          {person.sources.map((s, i) => {
            const owed = s.direction === 'owed_to_me'
            return (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge variant="muted" className="text-[10px]">{SOURCE_LABELS[s.type] || s.type}</Badge>
                  {s.type === 'installment' && s.total_terms != null && (
                    <span className="text-[10px] text-muted-foreground shrink-0">( {s.term} / {s.total_terms} )</span>
                  )}
                  <span className="text-muted-foreground truncate">{s.type === 'installment' && s.total_terms != null ? '· ' : ''}{s.label}{s.split ? ' *' : ''}</span>
                </div>
                <span className={cn('font-medium shrink-0', owed ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                  {owed ? '' : '−'}{formatCurrency(s.amount)}
                </span>
              </div>
            )
          })}
          <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => onSettle(person)}>
            <HandCoins className="w-3.5 h-3.5 mr-1.5" />Settle up
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Settle-up modal: pick which of a person's items a payment covers ─────────
function SettleUpModal({ person, month, year, onClose }) {
  const qc = useQueryClient()
  const [checked, setChecked] = useState(() => new Set(person.sources.map((_, i) => i)))
  const [loanAmounts, setLoanAmounts] = useState({}) // source index → amount string

  const mutation = useMutation({
    mutationFn: (items) => settleUp(month, year, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      onClose()
    },
  })

  const toggle = (i) => setChecked(s => {
    const n = new Set(s)
    n.has(i) ? n.delete(i) : n.add(i)
    return n
  })

  const amountFor = (s, i) => {
    if (s.type === 'loan' && loanAmounts[i] !== undefined && loanAmounts[i] !== '') {
      return Math.min(parseFloat(loanAmounts[i]) || 0, s.amount)
    }
    return s.amount
  }

  // What this settle-up nets out to: their payments to me minus mine to them.
  const total = person.sources.reduce((sum, s, i) => {
    if (!checked.has(i)) return sum
    return sum + (s.direction === 'owed_to_me' ? amountFor(s, i) : -amountFor(s, i))
  }, 0)

  const submit = () => {
    const items = person.sources
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => checked.has(i))
      .map(({ s, i }) => ({
        type: s.type,
        id: s.id,
        direction: s.direction,
        person_id: person.person_id,
        settle_period: s.settle_period ?? null,
        ...(s.type === 'loan' ? { amount: amountFor(s, i) } : {}),
      }))
    if (items.length) mutation.mutate(items)
  }

  return (
    <Modal open onClose={onClose} title={`Settle up · ${person.nickname || person.name}`}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <span className={cn('text-sm font-semibold tabular-nums', total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
            {total >= 0 ? 'They pay you ' : 'You pay '}{formatCurrency(Math.abs(total))}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={checked.size === 0 || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Record'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Tick what this payment covers. Items are marked settled; loans get a payment recorded.
        </p>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {person.sources.map((s, i) => {
            const owed = s.direction === 'owed_to_me'
            return (
              <label key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent cursor-pointer">
                <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)}
                  className="w-4 h-4 rounded border-border shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="muted" className="text-[10px]">{SOURCE_LABELS[s.type] || s.type}</Badge>
                    <span className="text-sm truncate">{s.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {owed ? 'they owe you' : 'you owe them'}
                  </span>
                </div>
                {s.type === 'loan' && checked.has(i) ? (
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0" max={s.amount}
                    value={loanAmounts[i] ?? ''}
                    placeholder={String(s.amount)}
                    onClick={e => e.preventDefault()}
                    onChange={e => setLoanAmounts(a => ({ ...a, [i]: e.target.value }))}
                    className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm text-right shrink-0"
                  />
                ) : (
                  <span className={cn('text-sm font-medium tabular-nums shrink-0', owed ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                    {owed ? '' : '−'}{formatCurrency(s.amount)}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 1, label: '1st–15th' },
  { value: 2, label: '16th–end' },
]

export default function Summary() {
  const { month, year } = usePeriod()
  const [period, setPeriod] = useState('all')
  const [showPicker, setShowPicker] = useState(false)
  const [imagePeriod, setImagePeriod] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [copyMsg, setCopyMsg] = useState('')
  const [settlePerson, setSettlePerson] = useState(null)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => getDashboardSummary(month, year).then(r => r.data),
  })
  const swipe = useMonthSwipe()

  if (isLoading) return <LoadingState text="Loading summary…" />
  if (!data) return null

  const stats = [
    { label: 'Income', value: data.total_income, icon: TrendingUp, color: 'text-green-600 dark:text-green-400', chip: 'bg-green-500/10' },
    { label: 'Expenses', value: data.total_expenses, icon: TrendingDown, color: 'text-red-500', chip: 'bg-red-500/10' },
    { label: 'Bills', value: data.total_bills, icon: AlertCircle, color: 'text-blue-500', chip: 'bg-blue-500/10' },
    { label: 'Installments', value: data.total_installments, icon: Wallet, color: 'text-orange-500', chip: 'bg-orange-500/10' },
  ]

  // Build a single net balance per person from their sources, scoped to a period.
  // Loans (period === null) always show; bill/installment shares filter by period.
  const buildBalances = (periodVal) => (data.people_balances || [])
    .map(p => {
      const sources = (p.sources || []).filter(s =>
        periodVal === 'all' || s.period === periodVal || s.period == null
      )
      const owed = sources.filter(s => s.direction === 'owed_to_me').reduce((sum, s) => sum + s.amount, 0)
      const owe = sources.filter(s => s.direction === 'i_owe').reduce((sum, s) => sum + s.amount, 0)
      // Show owed sources first, then i_owe, each largest first
      sources.sort((a, b) =>
        (a.direction === b.direction) ? b.amount - a.amount : (a.direction === 'owed_to_me' ? -1 : 1)
      )
      return { ...p, sources, net: owed - owe }
    })
    .filter(p => Math.abs(p.net) > 0.005)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const balances = buildBalances(period)
  const net_balance = balances.reduce((s, p) => s + p.net, 0)

  // Reimbursements I'm waiting on: shares of items I've already paid for,
  // grouped by item (Balances shows the same money grouped by person).
  const awaitingMap = new Map()
  balances.forEach(p => (p.sources || []).forEach(s => {
    if (s.direction !== 'owed_to_me' || !s.awaiting || s.type === 'loan') return
    const key = `${s.type}-${s.id}-${s.period ?? ''}`
    const it = awaitingMap.get(key) || { type: s.type, label: s.label, total: 0, people: [] }
    it.total += s.amount
    it.people.push({ name: p.nickname || p.name, amount: s.amount })
    awaitingMap.set(key, it)
  }))
  const awaitingItems = [...awaitingMap.values()].sort((a, b) => b.total - a.total)
  const awaitingTotal = awaitingItems.reduce((s, it) => s + it.total, 0)

  // Image picker works off its own period selection.
  const imageBalances = buildBalances(imagePeriod)

  const openPicker = () => {
    setImagePeriod(period)
    setSelected(new Set(buildBalances(period).map(b => b.person_id)))
    setCopyMsg('')
    setShowPicker(true)
  }
  const pickImagePeriod = (val) => {
    setImagePeriod(val)
    setSelected(new Set(buildBalances(val).map(b => b.person_id)))
    setCopyMsg('')
  }
  const toggleOne = (id) => setSelected(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const allSelected = imageBalances.length > 0 && selected.size === imageBalances.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(imageBalances.map(b => b.person_id)))

  const buildCanvas = () => {
    const rows = imageBalances.filter(b => selected.has(b.person_id))
    if (!rows.length) return null
    const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
    const periodLabel = imagePeriod === 'all' ? '' : (imagePeriod === 1 ? ' · 1st–15th' : ' · 16th–end')
    return renderBalancesImage(rows, monthLabel + periodLabel)
  }

  const copyImage = async () => {
    const canvas = buildCanvas()
    if (!canvas) return
    const blobPromise = new Promise(res => canvas.toBlob(res, 'image/png'))
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blobPromise })])
      setCopyMsg('✓ Copied table image to clipboard!')
    } catch {
      setCopyMsg('Clipboard blocked here — use Download instead.')
    }
  }

  const downloadImage = async () => {
    const canvas = buildCanvas()
    if (!canvas) return
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balances-${year}-${String(month).padStart(2, '0')}.png`
    a.click()
    URL.revokeObjectURL(url)
    setCopyMsg('✓ Downloaded image.')
  }

  return (
    <PullToRefresh onRefresh={refetch}>
    <div {...swipe()} style={{ touchAction: 'pan-y' }} className="space-y-6">
      <PageHeader
        title="Summary"
        help="This month at a glance: your net cash, category totals, who owes you (and whom you owe), and what's due in the next 7 days."
        subtitle={new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
      />

      {/* Net cash "wallet card" — the app's signature surface. Derives fully
          from --primary so every theme skin recolors it. */}
      <div
        className="relative overflow-hidden rounded-2xl text-primary-foreground shadow-lg shadow-primary/25"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.72) 100%)' }}
      >
        <Wallet className="absolute -right-5 -bottom-6 w-36 h-36 opacity-[0.12] rotate-[-8deg] pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-85">My net cash</p>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full',
              data.net_cash_mine >= 0 ? 'bg-primary-foreground/15' : 'bg-red-950/30')}>
              {data.net_cash_mine >= 0 ? 'Positive' : 'Negative'}
            </span>
          </div>
          <p className="text-4xl font-bold tabular-nums mt-2 tracking-tight">
            {formatCurrency(data.net_cash_mine)}
          </p>
          <p className="text-xs opacity-75 mt-1">after my share of bills, installments & expenses</p>
          <div className="mt-5 pt-3 border-t border-primary-foreground/20 flex items-center justify-between text-sm">
            <span className="opacity-80">If I front everyone's full share</span>
            <span className="font-semibold tabular-nums">{formatCurrency(data.net_position)}</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, color, chip }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4 min-w-0">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', chip)}>
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                </span>
                <span className="text-xs text-muted-foreground truncate">{label}</span>
              </div>
              <p className="text-lg sm:text-xl font-semibold tabular-nums break-words leading-tight">{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* People balances */}
      {data.people_balances?.length > 0 && (
        <div className="space-y-3">
          {/* Period toggle + image export */}
          <div className="flex gap-1.5 items-center">
            <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <Button size="sm" variant="outline" className="ml-auto" onClick={openPicker} disabled={balances.length === 0}>
              <ImageDown className="w-4 h-4 mr-1.5" />Summary image
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Balances · net per person</CardTitle>
                <span className={cn('text-sm font-bold', net_balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                  {net_balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(net_balance))}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {balances.length > 0
                ? balances.map(p => <PersonBalanceRow key={p.person_id} person={p} onSettle={setSettlePerson} />)
                : <p className="text-sm text-muted-foreground">Nothing for this period.</p>
              }
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reimbursements I've fronted and am waiting on */}
      {awaitingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                Awaiting reimbursement
              </CardTitle>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCurrency(awaitingTotal)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {awaitingItems.map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="muted" className="text-[10px]">{SOURCE_LABELS[it.type] || it.type}</Badge>
                    <span className="truncate">{it.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    from {it.people.map(p => `${p.name} ${formatCurrency(p.amount)}`).join(' · ')}
                  </p>
                </div>
                <span className="font-medium tabular-nums shrink-0 text-amber-600 dark:text-amber-400">
                  {formatCurrency(it.total)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upcoming (next 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming_payments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due soon.</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming_payments?.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={p.type === 'bill' ? 'default' : 'warning'}>{p.type}</Badge>
                      <span>{p.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Loans nearing completion */}
        {data.loans_nearing_completion?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Loans Nearing Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.loans_nearing_completion.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{l.direction} — {formatCurrency(l.principal)}</span>
                    <Badge variant="warning">{l.terms_remaining} terms left</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {settlePerson && (
        <SettleUpModal person={settlePerson} month={month} year={year} onClose={() => setSettlePerson(null)} />
      )}

      {/* People picker → table image */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="Summary image"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPicker(false)}>Cancel</Button>
            <Button variant="secondary" onClick={downloadImage} disabled={selected.size === 0}>
              <Download className="w-4 h-4 mr-1.5" />Download
            </Button>
            <Button onClick={copyImage} disabled={selected.size === 0}>
              <ImageDown className="w-4 h-4 mr-1.5" />Copy
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Which period to summarize:</p>
            <SegmentedControl options={PERIOD_OPTIONS} value={imagePeriod} onChange={pickImagePeriod} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pick who to include.</p>
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {imageBalances.length === 0 && <p className="text-sm text-muted-foreground py-2">No balances for this period.</p>}
            {imageBalances.map(b => (
              <label key={b.person_id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input type="checkbox" checked={selected.has(b.person_id)} onChange={() => toggleOne(b.person_id)} className="w-4 h-4 rounded border-border" />
                  <PersonAvatar person={b} />
                  <span className="text-sm truncate">{b.nickname || b.name}</span>
                </div>
                <span className={cn('text-sm font-medium shrink-0', b.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                  {b.net >= 0 ? '' : '−'}{formatCurrency(Math.abs(b.net))}
                </span>
              </label>
            ))}
          </div>
          {copyMsg && <p className="text-sm text-muted-foreground">{copyMsg}</p>}
        </div>
      </Modal>
    </div>
    </PullToRefresh>
  )
}
