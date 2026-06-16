import { Loader2 } from 'lucide-react'

// Inline centered spinner — use for whole-page or section loads.
export function LoadingState({ text = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      {text}
    </div>
  )
}

// A single shimmering placeholder bar.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

// Placeholder rows that mimic a list while data is loading.
export function SkeletonList({ rows = 4, className = '' }) {
  return (
    <ul className={`divide-y divide-border ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="py-3 flex items-center justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  )
}
