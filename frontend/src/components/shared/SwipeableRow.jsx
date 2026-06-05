import { useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { cn } from '@/lib/utils'

const BTN_WIDTH = 68

/**
 * A list row that reveals action buttons when swiped left (touch only).
 * `actions`: [{ icon, label, onClick, className }]. Desktop is unaffected —
 * pointer drags don't fire, and the row renders normally.
 */
export function SwipeableRow({ actions = [], children, className }) {
  const width = actions.length * BTN_WIDTH
  const [x, setX] = useState(0)
  const open = useRef(false)

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx], last, tap }) => {
      if (tap) return
      const base = open.current ? -width : 0
      let nx = Math.max(-width, Math.min(0, base + mx))
      if (last) {
        const shouldOpen = nx < -width / 2 || (vx > 0.4 && dx < 0)
        open.current = shouldOpen
        setX(shouldOpen ? -width : 0)
      } else {
        setX(nx)
      }
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true }, enabled: actions.length > 0 }
  )

  const close = () => { open.current = false; setX(0) }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Action buttons behind the row */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a, i) => {
          const Icon = a.icon
          return (
            <button
              key={i}
              onClick={() => { a.onClick(); close() }}
              style={{ width: BTN_WIDTH }}
              className={cn('flex flex-col items-center justify-center gap-1 text-xs font-medium text-white', a.className || 'bg-muted-foreground')}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {a.label}
            </button>
          )
        })}
      </div>
      {/* Foreground (draggable) */}
      <div
        {...bind()}
        onClick={() => { if (open.current) close() }}
        style={{ transform: `translateX(${x}px)`, touchAction: 'pan-y' }}
        className="relative bg-card will-change-transform"
      >
        {children}
      </div>
    </div>
  )
}
