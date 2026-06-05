// Local app-lock: a PIN (hashed in localStorage) plus optional platform
// biometrics via WebAuthn. This gates the UI on a shared device — it is NOT a
// server-side auth boundary. The biometric check is verified locally (we trust
// a resolved navigator.credentials.get), which is appropriate for a screen lock.

const KEY = 'applock'
const DEFAULT_TIMEOUT_MS = 60_000 // lock after 1 min in background

export function getLockConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

function setLockConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function isLockEnabled() {
  const c = getLockConfig()
  return !!c.enabled && !!c.pinHash
}

export function getTimeoutMs() {
  return getLockConfig().timeoutMs ?? DEFAULT_TIMEOUT_MS
}

export function isBiometricConfigured() {
  const c = getLockConfig()
  return !!c.biometric?.enabled && !!c.biometric?.credentialId
}

// ---- PIN ----

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPin(pin, salt) {
  return sha256(`${salt}:${pin}`)
}

function randomSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function setPin(pin, timeoutMs) {
  const salt = randomSalt()
  const pinHash = await hashPin(pin, salt)
  const c = getLockConfig()
  setLockConfig({ ...c, enabled: true, salt, pinHash, timeoutMs: timeoutMs ?? c.timeoutMs ?? DEFAULT_TIMEOUT_MS })
}

export async function verifyPin(pin) {
  const c = getLockConfig()
  if (!c.pinHash || !c.salt) return false
  return (await hashPin(pin, c.salt)) === c.pinHash
}

export function setTimeoutPref(timeoutMs) {
  setLockConfig({ ...getLockConfig(), timeoutMs })
}

export function disableLock() {
  // Fully clear lock + biometric config.
  localStorage.removeItem(KEY)
}

// ---- WebAuthn biometrics ----

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential || !window.isSecureContext) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function registerBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'track.it', id: location.hostname },
      user: { id: userId, name: 'track.it', displayName: 'track.it' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
    },
  })
  const credentialId = bufToB64(cred.rawId)
  const c = getLockConfig()
  setLockConfig({ ...c, biometric: { enabled: true, credentialId } })
  return credentialId
}

export async function verifyBiometric() {
  const c = getLockConfig()
  const id = c.biometric?.credentialId
  if (!id) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60_000,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: b64ToBuf(id) }],
      userVerification: 'required',
    },
  })
  // Resolves only if the platform verified the user.
  return true
}

export function disableBiometric() {
  const c = getLockConfig()
  if (c.biometric) {
    delete c.biometric
    setLockConfig(c)
  }
}
