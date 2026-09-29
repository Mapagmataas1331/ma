import { api } from '@ma/api-client'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const NOTIFY_KEY = 'ma.chat.notify'

function isIOSHomeScreenLike() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS desktop UA
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function notifyPrefOn() {
  if (typeof localStorage === 'undefined') return false
  const stored = localStorage.getItem(NOTIFY_KEY)
  if (stored === '0') return false
  if (stored === '1') return true
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function setNotifyPref(on: boolean) {
  localStorage.setItem(NOTIFY_KEY, on ? '1' : '0')
}

export async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return false
  const { public_key: key } = await api<{ public_key: string }>('/v1/push/vapid-public-key').catch(() => ({ public_key: '' }))
  // Local alerts still work without VAPID; push when the tab is closed needs server keys.
  if (!key) {
    setNotifyPref(true)
    return true
  }
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  // Prefer a fresh subscribe when missing; otherwise refresh the server copy (Apple endpoints rotate).
  const sub =
    existing ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false
  await api('/v1/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
  })
  setNotifyPref(true)
  return true
}

export function notifyHere(title: string, body: string, tag: string, force = false) {
  if (!notifyPrefOn()) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!force && !document.hidden && document.hasFocus()) return
  const opts: NotificationOptions = { body, tag, icon: '/web-app-manifest-192x192.png' }
  // iOS Home Screen freezes page JS quickly; SW showNotification is more reliable while still warm.
  if (isIOSHomeScreenLike() && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => undefined)
    return
  }
  try {
    new Notification(title, opts)
  } catch {
    void navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, opts)).catch(() => undefined)
  }
}

/** Unread count on the home-screen / taskbar icon when the Badging API exists. */
export function setAppBadge(count: number) {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }) : null
  if (!nav?.setAppBadge) return
  if (count > 0) void nav.setAppBadge(count).catch(() => undefined)
  else void nav.clearAppBadge?.().catch(() => undefined)
}
