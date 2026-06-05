import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { MonthNavigator } from './MonthNavigator'

// Pages whose data is scoped to the viewed month.
const MONTH_AWARE = ['/expenses', '/bills', '/installments', '/income', '/summary', '/calendar']

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const showNav = MONTH_AWARE.includes(pathname)

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-56 overflow-y-auto">
        {showNav && (
          <div className="sticky top-0 z-20 flex justify-center border-b border-border bg-background/80 backdrop-blur px-6 py-2.5">
            <MonthNavigator />
          </div>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
