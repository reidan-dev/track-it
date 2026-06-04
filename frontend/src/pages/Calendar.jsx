import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCalendarEvents } from '@/api/dashboard'
import { Card, CardContent } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TYPE_COLORS = {
  bill: 'text-blue-500',
  installment: 'text-orange-500',
  loan: 'text-red-500',
  income: 'text-green-500',
}

const TYPE_BADGE = {
  bill: 'default',
  installment: 'warning',
  loan: 'danger',
  income: 'success',
}

function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(month, year) {
  return new Date(year, month - 1, 1).getDay()
}

export default function CalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)
  const [visibleTypes, setVisibleTypes] = useState(new Set(['bill', 'installment', 'loan', 'income']))

  const { data } = useQuery({
    queryKey: ['calendar', month, year],
    queryFn: () => getCalendarEvents(month, year).then(r => r.data),
  })

  const events = data?.events || []

  const eventsByDay = {}
  events.forEach(e => {
    if (!visibleTypes.has(e.type)) return
    const day = new Date(e.date).getDate()
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const daysInMonth = getDaysInMonth(month, year)
  const firstDay = getFirstDayOfMonth(month, year)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)

  const prev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const toggleType = (t) => {
    setVisibleTypes(prev => {
      const s = new Set(prev)
      s.has(t) ? s.delete(t) : s.add(t)
      return s
    })
  }

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded hover:bg-accent"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={next} className="p-1.5 rounded hover:bg-accent"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Type toggles */}
      <div className="flex gap-2 flex-wrap">
        {['bill', 'installment', 'loan', 'income'].map(t => (
          <button key={t} onClick={() => toggleType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${visibleTypes.has(t) ? 'border-transparent' : 'border-border bg-transparent opacity-40'}
              ${t === 'bill' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
              ${t === 'installment' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : ''}
              ${t === 'loan' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
              ${t === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
            `}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
        ))}
        {blanks.map(b => <div key={`b${b}`} />)}
        {days.map(day => {
          const dayEvents = eventsByDay[day] || []
          const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear()
          const isSelected = day === selectedDay
          return (
            <div
              key={day}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={`min-h-[64px] p-1.5 rounded-md border cursor-pointer transition-colors
                ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}
                ${isToday ? 'bg-primary/10' : ''}`}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <div key={i} className={`text-[10px] truncate ${TYPE_COLORS[e.type]}`}>
                    {e.name || e.direction} {e.paid && '✓'}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <Card>
          <CardContent className="py-4">
            <p className="font-semibold text-sm mb-3">
              {new Date(year, month - 1, selectedDay).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={TYPE_BADGE[e.type]}>{e.type}</Badge>
                      <span>{e.name || e.direction}</span>
                      {e.paid && <span className="text-green-500 text-xs">paid</span>}
                    </div>
                    <span className="font-medium">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
