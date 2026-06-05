import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod } from '@/contexts/PeriodContext'
import { MONTH_NAMES } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function MonthNavigator() {
  const { month, year, prev, next, reset, isCurrent } = usePeriod()
  return (
    <div className="flex items-center gap-1">
      <button onClick={prev} aria-label="Previous month"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={reset} title={isCurrent ? 'Current month' : 'Jump to current month'}
        className={cn('min-w-[150px] text-center text-sm font-semibold tabular-nums px-2 py-1 rounded-md hover:bg-accent transition-colors',
          !isCurrent && 'text-primary')}>
        {MONTH_NAMES[month - 1]} {year}
      </button>
      <button onClick={next} aria-label="Next month"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
