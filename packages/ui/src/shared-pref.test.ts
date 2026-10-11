import { afterEach, describe, expect, it } from 'vitest'
import { readSharedPref, sharedCookieDomain, writeSharedPref } from './shared-pref'

function clearCookie(key: string) {
  document.cookie = `${key}=; Path=/; Max-Age=0`
}

describe('shared prefs', () => {
  afterEach(() => {
    clearCookie('ma.test')
    localStorage.clear()
  })

  it('scopes the cookie to ma.cyou on every subdomain and keeps it host-only elsewhere', () => {
    expect(sharedCookieDomain('ma.cyou')).toBe('ma.cyou')
    expect(sharedCookieDomain('chat.ma.cyou')).toBe('ma.cyou')
    expect(sharedCookieDomain('me.ma.cyou')).toBe('ma.cyou')
    expect(sharedCookieDomain('localhost')).toBeNull()
    expect(sharedCookieDomain('evilma.cyou')).toBeNull()
  })

  it('writes both stores and reads the cookie first', () => {
    writeSharedPref('ma.test', JSON.stringify({ mode: 'dark', accentH: 200 }))
    expect(localStorage.getItem('ma.test')).toBe('{"mode":"dark","accentH":200}')
    expect(document.cookie).toContain('ma.test=')
    // another app changed it: the cookie is newer than this origin's localStorage
    localStorage.setItem('ma.test', 'stale')
    expect(readSharedPref('ma.test')).toBe('{"mode":"dark","accentH":200}')
  })

  it('falls back to localStorage when there is no cookie yet', () => {
    localStorage.setItem('ma.test', 'light')
    expect(readSharedPref('ma.test')).toBe('light')
  })
})
