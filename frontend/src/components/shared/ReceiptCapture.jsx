import { useRef, useState } from 'react'
import { Camera, ImageIcon, X, Loader2 } from 'lucide-react'

/**
 * Resize + compress an image File to a JPEG data URL small enough to store
 * inline (base64) on the expense. Keeps the longest edge <= maxEdge.
 */
function compressImage(file, maxEdge = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => { img.src = reader.result }
    reader.onerror = reject
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxEdge) { height = Math.round(height * maxEdge / width); width = maxEdge }
      else if (height > maxEdge) { width = Math.round(width * maxEdge / height); height = maxEdge }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Receipt photo attach control. `value` is a data URL (or null). Calls
 * onChange with the compressed data URL, or null when removed.
 */
export function ReceiptCapture({ value, onChange, loading }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await compressImage(file)
      onChange(dataUrl)
    } catch {
      // ignore — leave existing value
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground h-24 rounded-lg border border-dashed border-border justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading receipt…
      </div>
    )
  }

  if (value) {
    return (
      <div className="relative inline-block">
        <a href={value} target="_blank" rel="noreferrer">
          <img src={value} alt="Receipt" className="h-32 w-auto max-w-full rounded-lg border border-border object-cover" />
        </a>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove receipt"
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
        className="flex-1 flex flex-col items-center justify-center gap-1 h-24 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        <span className="text-xs font-medium">Take photo</span>
      </button>
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        disabled={busy}
        className="flex-1 flex flex-col items-center justify-center gap-1 h-24 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
      >
        <ImageIcon className="w-5 h-5" />
        <span className="text-xs font-medium">Choose photo</span>
      </button>
    </div>
  )
}
