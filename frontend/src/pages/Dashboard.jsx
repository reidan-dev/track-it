import { useQuery } from '@tanstack/react-query'
import { HelpTip } from '@/components/shared/HelpTip'
import { getDashboardSummary, getDashboardTrends } from '@/api/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#6b7280']

const fmtAxis = (v) => {
  const n = Math.abs(v)
  if (n >= 1000) return `${(v / 1000).toFixed(0)}k`
  return String(v)
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.payload?.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium ml-auto">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function EmptyChart({ children }) {
  return <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">{children}</div>
}

export default function Dashboard() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => getDashboardSummary(month, year).then(r => r.data),
  })
  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ['dashboard-trends', 6],
    queryFn: () => getDashboardTrends(6).then(r => r.data),
  })

  if (loadingSummary || loadingTrends) return <div className="text-muted-foreground">Loading…</div>

  const series = trends?.series || []
  const categories = summary?.expenses_by_category || []
  const billsPaid = summary?.bills_paid_amount || 0
  const billsUnpaid = summary?.bills_unpaid_amount || 0
  const billsData = [
    { name: 'Paid', value: billsPaid, fill: '#10b981' },
    { name: 'Unpaid', value: billsUnpaid, fill: '#ef4444' },
  ].filter(d => d.value > 0)

  // Net balance per person (collapse owed/owe to a single net)
  const balances = (summary?.people_balances || [])
    .map(p => {
      const owed = (p.sources || []).filter(s => s.direction === 'owed_to_me').reduce((a, s) => a + s.amount, 0)
      const owe = (p.sources || []).filter(s => s.direction === 'i_owe').reduce((a, s) => a + s.amount, 0)
      return { name: p.nickname || p.name, color: p.color || '#64748b', net: owed - owe }
    })
    .filter(p => Math.abs(p.net) > 0.005)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 6)
  const maxBal = Math.max(1, ...balances.map(b => Math.abs(b.net)))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-1.5">Dashboard <HelpTip text="Visual charts of your money — income vs expenses, spending by category, bill status, and your net-cash trend over the last 6 months." /></h1>
        <p className="text-muted-foreground text-sm">
          {new Date(year, now.getMonth()).toLocaleString('default', { month: 'long', year: 'numeric' })} · last 6 months
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {series.length === 0 ? <EmptyChart>No data yet.</EmptyChart> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={36} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'transparent' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Net cash trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">My Net Cash Trend</CardTitle></CardHeader>
          <CardContent>
            {series.length === 0 ? <EmptyChart>No data yet.</EmptyChart> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={36} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="net_cash_mine" name="Net cash" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Spend by category */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Spend by Category</CardTitle></CardHeader>
          <CardContent>
            {categories.length === 0 ? <EmptyChart>No expenses this month.</EmptyChart> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categories} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {categories.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bills paid vs unpaid */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Bills · Paid vs Unpaid</CardTitle></CardHeader>
          <CardContent>
            {billsData.length === 0 ? <EmptyChart>No active bills.</EmptyChart> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={billsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {billsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Balances · net per person</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {balances.map((b, i) => {
              const positive = b.net >= 0
              const pct = (Math.abs(b.net) / maxBal) * 100
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 truncate shrink-0">{b.name}</span>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded', positive ? 'bg-green-500' : 'bg-red-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn('w-24 text-right font-medium shrink-0', positive ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
                    {positive ? '+' : '−'}{formatCurrency(Math.abs(b.net))}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
