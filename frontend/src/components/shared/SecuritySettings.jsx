import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Label, Select } from '@/components/shared/Input'
import { Modal } from '@/components/shared/Modal'
import { Shield, Fingerprint } from 'lucide-react'
import {
  getLockConfig, isLockEnabled, isBiometricConfigured, isBiometricAvailable,
  setPin, setTimeoutPref, disableLock, registerBiometric, disableBiometric,
} from '@/lib/appLock'

const TIMEOUTS = [
  { v: 0, label: 'Immediately' },
  { v: 60_000, label: 'After 1 minute' },
  { v: 300_000, label: 'After 5 minutes' },
  { v: 900_000, label: 'After 15 minutes' },
]

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function PinModal({ open, onClose, onSet, title }) {
  const [pin, setPin1] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { if (open) { setPin1(''); setConfirm(''); setErr('') } }, [open])

  const onlyDigits = (s) => s.replace(/\D/g, '').slice(0, 4)

  const save = () => {
    if (pin.length !== 4) return setErr('PIN must be 4 digits.')
    if (pin !== confirm) return setErr('PINs don’t match.')
    onSet(pin)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className="sm:max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={pin.length !== 4 || confirm.length !== 4}>Save PIN</Button>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="space-y-1.5">
          <Label>Enter a 4-digit PIN</Label>
          <input inputMode="numeric" type="password" value={pin} autoFocus
            onChange={e => setPin1(onlyDigits(e.target.value))}
            className="w-full h-12 rounded-lg border border-input bg-background text-center text-2xl tracking-[0.5em] tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm PIN</Label>
          <input inputMode="numeric" type="password" value={confirm}
            onChange={e => setConfirm(onlyDigits(e.target.value))}
            className="w-full h-12 rounded-lg border border-input bg-background text-center text-2xl tracking-[0.5em] tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function SecuritySettings() {
  const [enabled, setEnabled] = useState(isLockEnabled())
  const [bioOn, setBioOn] = useState(isBiometricConfigured())
  const [bioAvailable, setBioAvailable] = useState(false)
  const [timeout, setTimeoutState] = useState(getLockConfig().timeoutMs ?? 60_000)
  const [pinModal, setPinModal] = useState(false)
  const [pinModalMode, setPinModalMode] = useState('set') // 'set' | 'change'
  const [bioMsg, setBioMsg] = useState('')

  useEffect(() => { isBiometricAvailable().then(setBioAvailable) }, [])

  const handleToggleLock = (next) => {
    if (next) {
      setPinModalMode('set')
      setPinModal(true)
    } else {
      disableLock()
      setEnabled(false)
      setBioOn(false)
    }
  }

  const handlePinSet = async (pin) => {
    await setPin(pin, timeout)
    setEnabled(true)
    setPinModal(false)
  }

  const handleToggleBio = async (next) => {
    setBioMsg('')
    if (next) {
      try {
        await registerBiometric()
        setBioOn(true)
      } catch {
        setBioMsg('Couldn’t set up biometrics. Your device may not support it, or it was cancelled.')
      }
    } else {
      disableBiometric()
      setBioOn(false)
    }
  }

  const handleTimeout = (v) => {
    setTimeoutState(v)
    if (isLockEnabled()) setTimeoutPref(v)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Shield className="w-4 h-4" /> App Lock</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Require a PIN (and optionally biometrics) to open track.it on this device. This protects your data locally — it doesn’t change your account login.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable app lock</p>
            <p className="text-xs text-muted-foreground">Lock with a 4-digit PIN</p>
          </div>
          <Toggle checked={enabled} onChange={handleToggleLock} />
        </div>

        {enabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><Fingerprint className="w-4 h-4" /> Biometric unlock</p>
                <p className="text-xs text-muted-foreground">
                  {bioAvailable ? 'Use Face ID / fingerprint, fall back to PIN' : 'Not available on this device/browser'}
                </p>
              </div>
              <Toggle checked={bioOn} onChange={handleToggleBio} disabled={!bioAvailable} />
            </div>
            {bioMsg && <p className="text-xs text-destructive">{bioMsg}</p>}

            <div className="space-y-1.5">
              <Label>Auto-lock</Label>
              <Select value={timeout} onChange={e => handleTimeout(Number(e.target.value))} className="w-48">
                {TIMEOUTS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">How long after leaving the app before it locks again.</p>
            </div>

            <Button variant="outline" size="sm" onClick={() => { setPinModalMode('change'); setPinModal(true) }}>
              Change PIN
            </Button>
          </>
        )}

        <PinModal
          open={pinModal}
          onClose={() => { setPinModal(false); if (!isLockEnabled()) setEnabled(false) }}
          onSet={handlePinSet}
          title={pinModalMode === 'change' ? 'Change PIN' : 'Set a PIN'}
        />
      </CardContent>
    </Card>
  )
}
