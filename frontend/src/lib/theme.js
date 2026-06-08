// Theme = base surface skin; accent = a separate, freely-picked tint layered on
// top. Both persist to localStorage (for no-flash bootstrap in index.html) and
// to the server via settings. Keep the dark-skin list + hex→hsl in sync with the
// inline bootstrap script in index.html.

export const BASE_THEMES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

// `id` must match a `.theme-<id>` block in index.css. `dark: true` skins also get
// the `.dark` class so Tailwind `dark:` utilities (status colours) resolve.
export const SKINS = [
  { id: 'midnight', label: 'Midnight', dark: true, swatch: '#4f6bed' },
  { id: 'slate', label: 'Slate', dark: true, swatch: '#3b82f6' },
  { id: 'nord', label: 'Nord', dark: true, swatch: '#88c0d0' },
  { id: 'forest', label: 'Forest', dark: true, swatch: '#22c55e' },
  { id: 'ocean', label: 'Ocean', dark: true, swatch: '#22d3ee' },
  { id: 'dracula', label: 'Dracula', dark: true, swatch: '#bd93f9' },
  { id: 'rosepine', label: 'Rosé Pine', dark: true, swatch: '#9ccfd8' },
  { id: 'sepia', label: 'Sepia', dark: false, swatch: '#b4632a' },
  { id: 'solarized', label: 'Solarized', dark: false, swatch: '#268bd2' },
  { id: 'mono', label: 'Mono', dark: false, swatch: '#333333' },
]

// Quick-pick accent colours shown next to the picker.
export const ACCENT_SWATCHES = [
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Violet', hex: '#8b5cf6' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Pink', hex: '#ec4899' },
  { label: 'Lime', hex: '#84cc16' },
]

// Old named palettes → hex, so values saved before the picker keep working.
const LEGACY_PALETTES = {
  emerald: '#10b981', violet: '#8b5cf6', rose: '#f43f5e', amber: '#f59e0b', cyan: '#06b6d4',
}

const SKIN_IDS = new Set(SKINS.map((s) => s.id))
const DARK_SKINS = new Set(SKINS.filter((s) => s.dark).map((s) => s.id))
const SKIN_CLASSES = SKINS.map((s) => 'theme-' + s.id)

export function hexToHsl(hex) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return null
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Resolve a stored palette value to a hex, or null for "auto / match theme".
export function resolveAccent(value) {
  if (!value || value === 'blue' || value === 'auto') return null
  if (value[0] === '#') return value
  return LEGACY_PALETTES[value] || null
}

export function applyTheme(theme) {
  const el = document.documentElement
  el.classList.remove('dark', ...SKIN_CLASSES)
  if (theme === 'dark') {
    el.classList.add('dark')
  } else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) el.classList.add('dark')
  } else if (SKIN_IDS.has(theme)) {
    el.classList.add('theme-' + theme)
    if (DARK_SKINS.has(theme)) el.classList.add('dark')
  }
  // 'light' => no class (the :root defaults)
  localStorage.setItem('theme', theme)
}

export function applyAccent(value) {
  const el = document.documentElement
  const hex = resolveAccent(value)
  if (!hex) {
    el.style.removeProperty('--primary')
    el.style.removeProperty('--ring')
    el.style.removeProperty('--primary-foreground')
  } else {
    const hsl = hexToHsl(hex)
    if (hsl) {
      el.style.setProperty('--primary', hsl)
      el.style.setProperty('--ring', hsl)
      el.style.setProperty('--primary-foreground', luminance(hex) > 0.6 ? '222 47% 11%' : '210 40% 98%')
    }
  }
  localStorage.setItem('palette', value || 'auto')
}
