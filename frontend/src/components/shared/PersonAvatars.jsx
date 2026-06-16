import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAvatarStyle } from '@/lib/avatarStyle'

const POP_WIDTH = 184
const MARGIN = 8

const ME_ID = 0
const ME_COLOR = '#3b82f6'

function resolvePerson(id, people) {
  if (id === ME_ID) return { id, name: 'Me', color: ME_COLOR, emoji: null, isMe: true }
  const p = people.find(x => x.id === id)
  if (!p) return { id, name: 'Unknown', color: '#64748b', emoji: null }
  return { id, name: p.nickname || p.name, color: p.color || '#64748b', emoji: p.emoji || null }
}

function initial(name) {
  return (name || '?').charAt(0).toUpperCase()
}

// A single avatar circle, rendered per the current avatar-style preference.
function Avatar({ person, style, size = 18, ring = true, settled = false }) {
  const showColor = style !== 'emoji'
  const showEmoji = style !== 'color' && person.emoji
  const px = { width: size, height: size, fontSize: Math.round(size * 0.5) }
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full shrink-0 font-semibold leading-none', ring && (settled ? 'ring-2 ring-green-500' : 'ring-2 ring-card'))}
      style={{
        ...px,
        backgroundColor: showColor ? person.color : 'hsl(var(--muted))',
        color: showColor ? '#fff' : 'hsl(var(--muted-foreground))',
      }}
    >
      {showEmoji ? person.emoji : initial(person.name)}
    </span>
  )
}

/**
 * Overlapping person avatars for an item header. Shows who's involved (split
 * participants, payer, lender…) as colored/emoji circles. Hover shows a name
 * tooltip; click opens a popover listing everyone with an optional role/amount.
 *
 * @param ids            person ids (0 = Me)
 * @param people         people list
 * @param roles          optional map { [id]: 'sub-label' } shown in the popover
 * @param max            how many circles before collapsing into "+N"
 * @param title          popover heading
 * @param settleableIds  ids that can toggle a "paid their share" state
 * @param settledIds     ids currently settled (paid their share)
 * @param onToggleSettled(id) toggles a person's settled state; enables the controls
 */
export function PersonAvatars({
  ids = [], people = [], roles = {}, max = 4, size = 18, title = 'Involved',
  settleableIds = [], settledIds = [], onToggleSettled,
}) {
  const style = useAvatarStyle()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  // Position the portalled popover next to the trigger, flipping above and
  // clamping to the viewport so it's never clipped by an item's overflow.
  const reposition = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const h = popRef.current?.offsetHeight || 0
    let left = Math.min(r.left, window.innerWidth - POP_WIDTH - MARGIN)
    left = Math.max(MARGIN, left)
    let top = r.bottom + 6
    if (h && top + h > window.innerHeight - MARGIN) {
      const above = r.top - h - 6
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - h - MARGIN)
    }
    setPos({ top, left })
  }

  // Reposition on open, and after toggles that may reflow/re-sort the list.
  useLayoutEffect(() => {
    if (open) reposition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settledIds.join(','), ids.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onMove = () => reposition()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const unique = [...new Set(ids)].filter(id => id != null)
  if (unique.length === 0) return null

  const settledSet = new Set(settledIds)
  const settleableSet = new Set(settleableIds)
  const resolved = unique.map(id => resolvePerson(id, people))
  const shown = resolved.slice(0, max)
  const overflow = resolved.length - shown.length
  const tooltip = resolved.map(p => p.name).join(', ')

  const toggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - POP_WIDTH - MARGIN))
      setPos({ top: r.bottom + 6, left })  // refined for height/flip in layout effect
    }
    setOpen(o => !o)
  }

  return (
    <>
      {/* span (not button) so it can nest inside header toggle buttons safely */}
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        title={tooltip}
        className="inline-flex items-center -space-x-1.5 hover:opacity-80 transition-opacity cursor-pointer align-middle"
        aria-label={`Involved: ${tooltip}`}
      >
        {shown.map(p => <Avatar key={p.id} person={p} style={style} size={size} settled={settleableSet.has(p.id) && settledSet.has(p.id)} />)}
        {overflow > 0 && (
          <span
            className="inline-flex items-center justify-center rounded-full shrink-0 font-semibold leading-none ring-2 ring-card bg-muted text-muted-foreground"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
          >
            +{overflow}
          </span>
        )}
      </span>

      {open && createPortal(
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_WIDTH }}
          className="z-50 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card text-card-foreground shadow-xl p-1.5 text-left"
        >
          <p className="px-1.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{title}</p>
          <ul className="space-y-0.5">
            {resolved.map(p => {
              const canToggle = !!onToggleSettled && settleableSet.has(p.id)
              const settled = settledSet.has(p.id)
              return (
                <li key={p.id} className="flex items-center gap-2 px-1.5 py-1 rounded">
                  <Avatar person={p} style={style} size={18} ring={false} />
                  <span className="min-w-0 flex-1">
                    <span className="text-xs font-medium truncate block">{p.name}</span>
                    {roles[p.id] && <span className="text-[10px] text-muted-foreground truncate block">{roles[p.id]}</span>}
                  </span>
                  {canToggle ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSettled(p.id) }}
                      title={settled ? 'Paid their share — click to undo' : 'Mark their share paid'}
                      className={cn('shrink-0 p-1 -m-1 transition-colors', settled ? 'text-green-500 hover:text-red-400' : 'text-muted-foreground hover:text-primary')}
                    >
                      {settled ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </button>
                  ) : settleableSet.has(p.id) && settled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>,
        document.body
      )}
    </>
  )
}
