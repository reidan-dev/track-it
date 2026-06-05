import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

const DISMISS_KEY = 'pwa-install-dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}

/**
 * Bottom banner offering "Add to Home Screen". Uses the native
 * beforeinstallprompt where available (Android/Chrome); falls back to a short
 * instruction on iOS Safari, which has no programmatic install.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires beforeinstallprompt — offer manual instructions instead.
    if (isIos()) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  const install = async () => {
    if (isIos()) { setIosHint(true); return }
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') dismiss()
    setDeferred(null)
  }

  if (!show) return null

  return (
    <div className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[45] p-3">
      <div className="rounded-xl border border-border bg-card shadow-lg p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Install track.it</p>
          {iosHint ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline" /> then “Add to Home Screen”.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Add it to your home screen for a full-screen app.</p>
          )}
        </div>
        {!iosHint && (
          <button onClick={install}
            className="shrink-0 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform">
            Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground rounded p-1.5 hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
