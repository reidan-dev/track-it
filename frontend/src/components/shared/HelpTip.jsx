import { HelpCircle } from 'lucide-react'

/**
 * A small "?" help icon that reveals a description on hover or focus.
 * Drop it next to a page/section title:  <h1 …>Bills <HelpTip text="…" /></h1>
 */
export function HelpTip({ text, className = '' }) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label="What is this for?"
        className="text-muted-foreground/50 hover:text-muted-foreground focus:text-muted-foreground focus:outline-none transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-border bg-card px-3 py-2 text-xs font-normal leading-relaxed text-card-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
