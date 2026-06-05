import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, footer, className }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // Lock background scroll while open (keeps mobile bottom sheets steady)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className={cn(
        'relative bg-card border-border shadow-lg w-full flex flex-col',
        // Mobile: full-width bottom sheet, rounded top, slide up
        'rounded-t-2xl border-t max-h-[92dvh] animate-sheet-up',
        // Desktop: centered card (default width; pages may override with sm:max-w-*)
        'sm:rounded-lg sm:border sm:max-w-md sm:max-h-[90vh] sm:animate-none',
        className
      )}>
        {/* Grab handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 sm:pt-5 shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close"
            className="text-muted-foreground hover:text-foreground rounded p-2 -mr-2 hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto scroll-touch px-5 py-2 flex-1 min-h-0">
          {children}
        </div>

        {/* Sticky footer — rendered if footer prop is passed */}
        {footer && (
          <div className="shrink-0 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-border bg-card sm:rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
