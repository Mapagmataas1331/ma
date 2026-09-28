import { beforeEach, describe, expect, it } from 'vitest'
import { dismissTransfer, loadPrefs, savePrefs, transferDismissed } from './prefs'

describe('per-user preferences', () => {
  beforeEach(() => localStorage.clear())

  it('does not share chat preferences between accounts', () => {
    savePrefs('user-a', { c1: { pinned: true } })
    savePrefs('user-b', { c1: { muted: true } })
    expect(loadPrefs('user-a').c1?.pinned).toBe(true)
    expect(loadPrefs('user-a').c1?.muted).toBeUndefined()
    expect(loadPrefs('user-b').c1?.muted).toBe(true)
  })

  it('remembers a dismissed transfer only for that account', () => {
    dismissTransfer('user-a')
    expect(transferDismissed('user-a')).toBe(true)
    expect(transferDismissed('user-b')).toBe(false)
  })
})
