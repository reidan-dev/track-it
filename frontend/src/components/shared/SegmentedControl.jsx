import { cn } from '@/lib/utils'

// Pill-style option switcher used for period filters and mode toggles.
// `options` is [{ value, label }]; `value` is the selected option's value.
export function SegmentedControl({ options, value, onChange, className }) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted', className)}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
