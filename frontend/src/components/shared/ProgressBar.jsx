import { cn } from '@/lib/utils'

export function ProgressBar({ value, max, className }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-yellow-500' : 'bg-primary'
  return (
    <div className={cn('w-full bg-muted rounded-full h-2', className)}>
      <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}
