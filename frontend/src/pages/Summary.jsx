import { useState } from 'react'
import { HelpTip } from '@/components/shared/HelpTip'
import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '@/api/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_LABELS = { loan: 'Loan', bill: 'Bill', installment: 'Installment' }

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

function PersonBalanceRow({ person }) {
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
            {positive ? '+' : '−'}{formatCurrency(Math.abs(net))}
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
                  <span className="text-muted-foreground truncate">{s.label}</span>
                </div>
                <span className={cn('font-medium shrink-0', owed ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                  {owed ? '+' : '−'}{formatCurrency(s.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 1, label: 'Period 1' },
  { value: 2, label: 'Period 2' },
]

export default function Summary() {
  const now = new Date()
  const [period, setPeriod] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => getDashboardSummary(now.getMonth() + 1, now.getFullYear()).then(r => r.data),
  })

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (!data) return null

  const stats = [
    { label: 'Income', value: data.total_income, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Expenses', value: data.total_expenses, icon: TrendingDown, color: 'text-red-500' },
    { label: 'Bills', value: data.total_bills, icon: AlertCircle, color: 'text-blue-500' },
    { label: 'Installments', value: data.total_installments, icon: Wallet, color: 'text-orange-500' },
  ]

  // Build a single net balance per person from their sources.
  // Loans (period === null) always show; bill/installment shares filter by period.
  const balances = (data.people_balances || [])
    .map(p => {
      const sources = (p.sources || []).filter(s =>
        period === 'all' || s.period === period || s.period == null
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

  const net_balance = balances.reduce((s, p) => s + p.net, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Summary <HelpTip text="This month at a glance: your net cash, category totals, who owes you (and whom you owe), and what's due in the next 7 days." /></h1>
        <p className="text-muted-foreground text-sm">
          {new Date(now.getFullYear(), now.getMonth()).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Net cash position */}
      <Card className={`border-2 ${data.net_cash_mine >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">My Net Cash</p>
              <p className={`text-3xl font-bold ${data.net_cash_mine >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(data.net_cash_mine)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">after my share of bills, installments & expenses</p>
            </div>
            <Badge variant={data.net_cash_mine >= 0 ? 'success' : 'danger'}>
              {data.net_cash_mine >= 0 ? 'Positive' : 'Negative'}
            </Badge>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">If I front everyone's full share</span>
            <span className={`font-semibold ${data.net_position >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {formatCurrency(data.net_position)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-semibold">{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* People balances */}
      {data.people_balances?.length > 0 && (
        <div className="space-y-3">
          {/* Period toggle */}
          <div className="flex gap-1.5">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  period === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Balances · net per person</CardTitle>
                <span className={cn('text-sm font-bold', net_balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                  {net_balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net_balance))}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {balances.length > 0
                ? balances.map(p => <PersonBalanceRow key={p.person_id} person={p} />)
                : <p className="text-sm text-muted-foreground">Nothing for this period.</p>
              }
            </CardContent>
          </Card>
        </div>
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
    </div>
  )
}
