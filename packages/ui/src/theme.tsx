import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeState = {
  mode: ThemeMode
  accentH: number
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  setAccentH: (hue: number) => void
}

const KEY = 'ma.theme'
const ThemeContext = createContext<ThemeState | null>(null)

function readStored(): { mode: ThemeMode; accentH: number } {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { mode: 'system', accentH: 262 }
    const parsed = JSON.parse(raw) as { mode?: ThemeMode; accentH?: number }
    const mode = parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system' ? parsed.mode : 'system'
    const accentH = typeof parsed.accentH === 'number' ? parsed.accentH : 262
    return { mode, accentH }
  } catch {
    return { mode: 'system', accentH: 262 }
  }
}

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = readStored()
  const [mode, setMode] = useState<ThemeMode>(stored.mode)
  const [accentH, setAccentH] = useState(stored.accentH)
  const [system, setSystem] = useState(systemDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = mode === 'system' ? (system ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.setProperty('--accent-h', String(accentH))
    localStorage.setItem(KEY, JSON.stringify({ mode, accentH }))
  }, [mode, accentH, resolved])

  const value = useMemo(
    () => ({ mode, accentH, resolved, setMode, setAccentH }),
    [mode, accentH, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
