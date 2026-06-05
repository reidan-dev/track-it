import { useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 70
const MAX = 110

/**
 * Wrap list content to enable pull-to-refresh on touch. Calls `onRefresh`
 * (which may return a promise) when pulled past the threshold from the top.
 */
export function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startTop = useRef(true)

  const bind = useDrag(
    ({ first, movement: [, my], last, cancel }) => {
      if (refreshing) return
      if (first) startTop.current = (window.scrollY || document.documentElement.scrollTop) <= 0
      if (!startTop.current || my <= 0) { if (pull) setPull(0); return }
      const dist = Math.min(MAX, my * 0.5)
      if (last) {
        if (dist >= THRESHOLD) {
          setRefreshing(true)
          setPull(THRESHOLD)
          Promise.resolve(onRefresh?.()).finally(() => { setRefreshing(false); setPull(0) })
        } else {
          setPull(0)
        }
      } else {
        setPull(dist)
      }
    },
    { axis: 'y', pointer: { touch: true }, filterTaps: true }
  )

  return (
    <div {...bind()} style={{ touchAction: 'pan-y' }}>
      <div
        className="flex items-center justify-center overflow-hidden text-muted-foreground"
        style={{ height: pull, transition: pull === 0 ? 'height 0.2s ease' : 'none' }}
      >
        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? 'none' : `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / THRESHOLD) }} />
      </div>
      {children}
    </div>
  )
}
