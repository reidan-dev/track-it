import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, footer, className }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md flex flex-col',
        'max-h-[90vh]',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-2 flex-1 min-h-0">
          {children}
        </div>

        {/* Sticky footer — rendered if footer prop is passed */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-border bg-card rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
