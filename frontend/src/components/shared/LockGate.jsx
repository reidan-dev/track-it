import { useEffect, useRef, useState, useCallback } from 'react'
import { Delete, Fingerprint, Lock } from 'lucide-react'
import {
  isLockEnabled, getTimeoutMs, verifyPin, isBiometricConfigured, verifyBiometric,
} from '@/lib/appLock'

const PIN_LENGTH = 4

function LockScreen({ onUnlocked }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [bioFailed, setBioFailed] = useState(false)
  const hasBio = isBiometricConfigured()

  const tryBiometric = useCallback(async () => {
    if (!hasBio) return
    try {
      await verifyBiometric()
      onUnlocked()
    } catch {
      setBioFailed(true)
    }
  }, [hasBio, onUnlocked])

  // No auto-prompt: show the PIN pad first; biometrics fire only on tap.

  const submit = useCallback(async (value) => {
    if (await verifyPin(value)) {
      onUnlocked()
    } else {
      setError(true)
      setTimeout(() => { setError(false); setPin('') }, 500)
    }
  }, [onUnlocked])

  const press = (d) => {
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      const next = prev + d
      if (next.length === PIN_LENGTH) submit(next)
      return next
    })
  }
  const backspace = () => setPin(prev => prev.slice(0, -1))

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-8 pt-safe pb-safe">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
        <Lock className="w-7 h-7" />
      </div>
      <h1 className="text-lg font-semibold">track.it is locked</h1>
      <p className="text-sm text-muted-foreground mt-1">Enter your PIN to continue</p>

      {/* PIN dots */}
      <div className={`flex gap-4 my-8 ${error ? 'animate-[shake_0.4s]' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
              i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'
            } ${error ? 'border-destructive' : ''}`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => press(String(n))}
            className="h-16 rounded-2xl bg-muted/60 text-2xl font-semibold active:bg-accent transition-colors">
            {n}
          </button>
        ))}
        <button onClick={hasBio ? tryBiometric : undefined}
          className={`h-16 rounded-2xl flex items-center justify-center ${hasBio ? 'text-primary active:bg-accent' : 'opacity-0 pointer-events-none'}`}>
          <Fingerprint className="w-7 h-7" />
        </button>
        <button onClick={() => press('0')}
          className="h-16 rounded-2xl bg-muted/60 text-2xl font-semibold active:bg-accent transition-colors">
          0
        </button>
        <button onClick={backspace}
          className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground active:bg-accent transition-colors">
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {hasBio && (
        <button onClick={tryBiometric} className="mt-6 text-sm text-primary font-medium flex items-center gap-1.5">
          <Fingerprint className="w-4 h-4" /> {bioFailed ? 'Try biometrics again' : 'Use biometrics'}
        </button>
      )}
    </div>
  )
}

/**
 * Gates its children behind the app lock when one is configured. Locks on
 * launch and when the app returns from background after the timeout.
 */
export function LockGate({ active = true, children }) {
  const [locked, setLocked] = useState(() => active && isLockEnabled())
  const hiddenAt = useRef(null)

  // Lock the moment a lock-enabled session becomes active (e.g. after login).
  useEffect(() => {
    if (active && isLockEnabled()) setLocked(true)
  }, [active])

  useEffect(() => {
    const onHide = () => { hiddenAt.current = Date.now() }
    const onShow = () => {
      if (!active || !isLockEnabled()) return
      if (hiddenAt.current && Date.now() - hiddenAt.current >= getTimeoutMs()) {
        setLocked(true)
      }
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? onHide() : onShow())

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('focus', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('focus', onShow)
    }
  }, [])

  return (
    <>
      {children}
      {active && locked && <LockScreen onUnlocked={() => setLocked(false)} />}
    </>
  )
}
