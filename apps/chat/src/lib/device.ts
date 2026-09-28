import { boxKeyPair, signKeyPair, b64, zero } from '@ma/crypto'
import { accountKey } from './db'

type PublicKeys = { ed25519: string; x25519: string }
type SecretKeys = PublicKeys & { signSk: Uint8Array; boxSk: Uint8Array }

const pending = new Map<string, SecretKeys>()

export function takeDeviceSecrets(userId: string) {
  const keys = pending.get(userId)
  if (!keys) return null
  pending.delete(userId)
  return keys
}

export function rememberDeviceSecrets(userId: string, keys: SecretKeys) {
  pending.set(userId, keys)
}

export function publicDeviceKeys(userId: string): PublicKeys | null {
  const keys = pending.get(userId)
  if (keys) return { ed25519: keys.ed25519, x25519: keys.x25519 }
  const raw = sessionStorage.getItem(accountKey(userId, 'device.pks'))
  if (!raw) return null
  return JSON.parse(raw) as PublicKeys
}

export function ensureDeviceSecrets(userId: string): PublicKeys {
  const existing = pending.get(userId)
  if (existing) return { ed25519: existing.ed25519, x25519: existing.x25519 }
  const sign = signKeyPair()
  const box = boxKeyPair()
  const keys: SecretKeys = {
    ed25519: b64(sign.publicKey),
    x25519: b64(box.publicKey),
    signSk: sign.privateKey,
    boxSk: box.privateKey,
  }
  pending.set(userId, keys)
  sessionStorage.setItem(accountKey(userId, 'device.pks'), JSON.stringify({ ed25519: keys.ed25519, x25519: keys.x25519 }))
  return { ed25519: keys.ed25519, x25519: keys.x25519 }
}

/** "Chrome on Windows" instead of a raw user-agent string in the device list. */
export function friendlyDeviceName(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /YaBrowser\//.test(ua) ? 'Yandex' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

export function clearDeviceSecrets() {
  for (const keys of pending.values()) {
    zero(keys.signSk)
    zero(keys.boxSk)
  }
  pending.clear()
}
