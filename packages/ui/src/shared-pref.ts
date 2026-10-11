/**
 * Preferences shared by every ma.cyou app (ma.cyou, me., projects., chat.). localStorage is per origin, so a
 * choice made on one subdomain (or one dev port) never reached the others. Each value is therefore also kept
 * in a cookie: on the parent domain in production, host-only on localhost (cookies ignore the port, so every
 * dev server shares it). The cookie wins on read; localStorage stays as the fallback when cookies are blocked.
 * The inline pre-paint script in every index.html reads the same cookie first. Keep the two in step.
 * The same helper lives in @ma/i18n (shared-pref.ts); the packages do not depend on each other.
 */
const PARENT_DOMAIN = 'ma.cyou'
/** Browsers cap cookie lifetime at 400 days; every write renews it. */
const MAX_AGE_S = 400 * 24 * 60 * 60

export function sharedCookieDomain(host: string) {
  return host === PARENT_DOMAIN || host.endsWith(`.${PARENT_DOMAIN}`) ? PARENT_DOMAIN : null
}

export function readSharedPref(key: string): string | null {
  if (typeof document !== 'undefined') {
    const prefix = `${key}=`
    for (const part of document.cookie.split(/;\s*/)) {
      if (!part.startsWith(prefix)) continue
      try {
        return decodeURIComponent(part.slice(prefix.length))
      } catch {
        break
      }
    }
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSharedPref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage disabled; the cookie below still carries it
  }
  if (typeof document === 'undefined') return
  const domain = sharedCookieDomain(location.hostname)
  const attrs = [`Path=/`, `Max-Age=${MAX_AGE_S}`, 'SameSite=Lax']
  if (domain) attrs.push(`Domain=${domain}`)
  if (location.protocol === 'https:') attrs.push('Secure')
  document.cookie = `${key}=${encodeURIComponent(value)}; ${attrs.join('; ')}`
}

/** Calls `onReturn` when the tab becomes visible or the window regains focus, so a change made in another app shows up. */
export function onSharedPrefReturn(onReturn: () => void) {
  if (typeof window === 'undefined') return () => {}
  const visible = () => {
    if (document.visibilityState === 'visible') onReturn()
  }
  document.addEventListener('visibilitychange', visible)
  window.addEventListener('focus', onReturn)
  return () => {
    document.removeEventListener('visibilitychange', visible)
    window.removeEventListener('focus', onReturn)
  }
}
