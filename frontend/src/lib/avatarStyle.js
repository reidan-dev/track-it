// How person avatars render in item headers: a colored dot, the person's emoji,
// or both layered together. Pure client-side UI preference, persisted to
// localStorage and broadcast so open pages re-render when it changes in Settings.

import { useEffect, useState } from 'react'

export const AVATAR_STYLES = [
  { id: 'both', label: 'Color + Emoji' },
  { id: 'color', label: 'Color only' },
  { id: 'emoji', label: 'Emoji only' },
]

const KEY = 'avatarStyle'
const EVENT = 'avatarstylechange'

export function getAvatarStyle() {
  const v = localStorage.getItem(KEY)
  return v === 'color' || v === 'emoji' || v === 'both' ? v : 'both'
}

export function setAvatarStyle(value) {
  localStorage.setItem(KEY, value)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
}

// Reactive read — updates live when the preference changes anywhere in the app.
export function useAvatarStyle() {
  const [style, setStyle] = useState(getAvatarStyle)
  useEffect(() => {
    const sync = () => setStyle(getAvatarStyle())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return style
}
