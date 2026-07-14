import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { BottomNav } from './BottomNav'
import { MonthNavigator } from './MonthNavigator'

// Pages whose data is scoped to the viewed month.
const MONTH_AWARE = ['/expenses', '/bills', '/installments', '/income', '/summary', '/calendar']

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const showNav = MONTH_AWARE.includes(pathname)

  return (
    <div className="min-h-screen-safe bg-background flex">
      <Sidebar />
      <main className="flex-1 md:ml-56 overflow-y-auto">
        {showNav && (
          <div className="sticky top-0 z-20 flex justify-center border-b border-border bg-background/80 backdrop-blur px-4 sm:px-6 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
            <MonthNavigator />
          </div>
        )}
        {/* Bottom padding on mobile clears the floating bottom nav + safe area */}
        <div className="p-4 sm:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
