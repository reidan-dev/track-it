import { useDrag } from '@use-gesture/react'
import { usePeriod } from '@/contexts/PeriodContext'

/**
 * Horizontal swipe to change the viewed month. Swipe left → next, right → prev.
 * Returns a bind() to spread onto the page container. Touch only; ignores
 * mostly-vertical drags so it never fights native scroll.
 */
export function useMonthSwipe() {
  const { prev, next } = usePeriod()
  return useDrag(
    ({ last, movement: [mx, my], velocity: [vx] }) => {
      if (!last) return
      if (Math.abs(mx) < 60 || Math.abs(mx) < Math.abs(my) * 1.5) return
      if (vx < 0.15 && Math.abs(mx) < 120) return
      if (mx < 0) next()
      else prev()
    },
    { axis: 'x', pointer: { touch: true }, filterTaps: true }
  )
}
