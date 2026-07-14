import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Calendar, Receipt, FileText, CreditCard,
  Landmark, TrendingUp, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const groups = [
  {
    label: 'Overview',
    links: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/summary', icon: ClipboardList, label: 'Summary' },
      { to: '/calendar', icon: Calendar, label: 'Calendar' },
    ],
  },
  {
    label: 'Money',
    links: [
      { to: '/expenses', icon: Receipt, label: 'Expenses' },
      { to: '/bills', icon: FileText, label: 'Bills' },
      { to: '/installments', icon: CreditCard, label: 'Installments' },
      { to: '/loans', icon: Landmark, label: 'Loans' },
      { to: '/income', icon: TrendingUp, label: 'Income' },
    ],
  },
  {
    label: 'Manage',
    links: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border/60 hidden md:flex flex-col z-30">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-lg shadow-sm shadow-primary/30" />
        <span className="text-lg font-bold tracking-tight">track.it</span>
      </div>
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.links.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border/60">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
