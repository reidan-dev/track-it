import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Calendar, MoreHorizontal, Plus,
  ClipboardList, FileText, CreditCard, Landmark, TrendingUp, Settings, LogOut, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { QuickAddSheet } from '@/components/shared/QuickAddSheet'

// Primary destinations on the bottom bar (2 left, FAB, 2 right).
const tabs = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
]

// Everything else lives in the "More" sheet.
const moreLinks = [
  { to: '/summary', icon: ClipboardList, label: 'Summary' },
  { to: '/bills', icon: FileText, label: 'Bills' },
  { to: '/installments', icon: CreditCard, label: 'Installments' },
  { to: '/loans', icon: Landmark, label: 'Loans' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function Tab({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn('flex items-center justify-center rounded-full px-4 py-0.5 transition-colors', isActive && 'bg-primary/10')}>
            <Icon className="w-5 h-5 shrink-0" />
          </span>
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    setMoreOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Floating pill tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 z-40 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg shadow-black/10 dark:shadow-black/40">
        <div className="relative flex items-stretch h-16">
          <Tab {...tabs[0]} />
          <Tab {...tabs[1]} />

          {/* Center FAB slot */}
          <div className="flex-1 flex items-start justify-center">
            <button
              onClick={() => setQuickAddOpen(true)}
              aria-label="Quick add"
              className="-translate-y-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <Tab {...tabs[2]} />
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-card rounded-t-2xl border-t border-border animate-sheet-up pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="text-base font-semibold">More</h2>
              <button onClick={() => setMoreOpen(false)} aria-label="Close"
                className="text-muted-foreground hover:text-foreground rounded p-2 -mr-2 hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pt-2 pb-3">
              {moreLinks.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 text-xs font-medium transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-foreground hover:bg-accent'
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="px-4 pt-1">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  )
}
