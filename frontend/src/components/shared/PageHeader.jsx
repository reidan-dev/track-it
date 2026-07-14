import { HelpTip } from '@/components/shared/HelpTip'

// Standard page top: title (+ optional help tip and subtitle) with an action
// slot that wraps below on narrow screens.
export function PageHeader({ title, help, subtitle, children }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold flex items-center gap-1.5">
          {title}
          {help && <HelpTip text={help} />}
        </h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  )
}
