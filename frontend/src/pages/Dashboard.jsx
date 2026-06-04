import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '@/api/dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#6b7280']

export default function Dashboard() {
  const now = new Date()
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {new Date(now.getFullYear(), now.getMonth()).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Net position */}
      <Card className={`border-2 ${data.net_position >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Cash Position</p>
              <p className={`text-3xl font-bold ${data.net_position >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(data.net_position)}
              </p>
            </div>
            <Badge variant={data.net_position >= 0 ? 'success' : 'danger'}>
              {data.net_position >= 0 ? 'Positive' : 'Negative'}
            </Badge>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by category */}
        {data.expenses_by_category?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Spend by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.expenses_by_category}>
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {data.expenses_by_category.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

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
      </div>

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
  )
}
