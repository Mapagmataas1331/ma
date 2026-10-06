import { ChevronDown, Menu, Moon, Settings, Sun } from 'lucide-react'
import { Component, lazy, Suspense, useEffect, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useTheme, type ThemeMode } from '../theme'
import { useTranslation } from 'react-i18next'
import { IconButton } from './button'
import { AppSettingsSlot } from './settings-slot'

// Everything behind an interaction (site menu, sheets, settings panel, ⌘K palette) is code-split and
// fetched on first hover/focus/open, so the header paints from the entry chunk alone.
const loadExtras = () => import('./shell-extras')
const loadAccount = () => import('./account-settings')
const SiteMenu = lazy(() => loadExtras().then((m) => ({ default: m.SiteMenu })))
const Sheet = lazy(() => loadExtras().then((m) => ({ default: m.Sheet })))
const CommandDialog = lazy(() => loadExtras().then((m) => ({ default: m.CommandDialog })))
const AccountSettings = lazy(() => loadAccount().then((m) => ({ default: m.AccountSettings })))
const preloadExtras = () => void loadExtras()
const preloadSettings = () => {
  void loadExtras()
  void loadAccount()
}

/** Suspense plus a tiny error boundary: a chunk that fails to load (offline, stale deploy) leaves the fallback instead of unmounting the app. */
class Deferred extends Component<{ fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    const fallback = this.props.fallback ?? null
    return this.state.failed ? fallback : <Suspense fallback={fallback}>{this.props.children}</Suspense>
  }
}

export type NavLink = { href: string; label: string; external?: boolean }

/** One entry in the subdomain / site switcher. */
export type SiteLink = {
  /** Short handle shown in the header (@, me, chat, …). */
  short: string
  label: string
  href: string
  current?: boolean
}

export function ThemeToggle() {
  const { t } = useTranslation('common')
  const { resolved, setMode } = useTheme()
  const next: ThemeMode = resolved === 'dark' ? 'light' : 'dark'
  return (
    <IconButton label={resolved === 'dark' ? t('switchToLight') : t('switchToDark')} onClick={() => setMode(next)}>
      {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  )
}

function SiteSwitcher({ sites }: { sites: SiteLink[] }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  // flips on the first real open; until then a plain button stands in for the Radix trigger
  const [menu, setMenu] = useState(false)
  const current = sites.find((site) => site.current) ?? sites[0]
  if (!current) return null
  const trigger = (extra?: {
    onPointerEnter: () => void
    onFocus: () => void
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
  }) => (
    <button
      type="button"
      className="ma-focusable group inline-flex h-9 max-w-[min(100%,14rem)] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-left transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:bg-surface-2/80 active:translate-y-0 active:scale-[0.98]"
      aria-label={t('sites')} title={t('sitesHint')}
      {...(extra ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': false, ...extra } : {})}
    >
      <span className="min-w-0 truncate font-semibold tracking-tight">
        {current.short === '@' ? (
          <span className="text-fg">ma.cyou</span>
        ) : (
          <>
            <span className="text-accent">{current.short}</span>
            <span className="text-muted">.ma.cyou</span>
          </>
        )}
      </span>
      <ChevronDown className="size-3.5 shrink-0 text-muted transition group-data-[state=open]:rotate-180" />
    </button>
  )
  const openMenu = () => {
    setMenu(true)
    setOpen(true)
  }
  // same gestures the Radix trigger reacts to: primary pointer down, Enter / Space / ArrowDown
  const placeholder = trigger({
    onPointerEnter: preloadExtras,
    onFocus: preloadExtras,
    onPointerDown: (e) => {
      if (e.button !== 0 || e.ctrlKey) return
      e.preventDefault()
      openMenu()
    },
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return
      e.preventDefault()
      openMenu()
    },
  })
  if (!menu) return placeholder
  return (
    <Deferred fallback={placeholder}>
      <SiteMenu sites={sites} label={t('sites')} trigger={trigger()} open={open} onOpenChange={setOpen} />
    </Deferred>
  )
}

export function AppShell({
  brand,
  sites = [],
  nav,
  actions,
  children,
  commandItems = [],
  fill = false,
}: {
  /** @deprecated Prefer `sites` — kept so older call sites still render a brand link. */
  brand?: { href: string; label: string }
  sites?: SiteLink[]
  nav: NavLink[]
  actions?: ReactNode
  children: ReactNode
  commandItems?: { id: string; label: string; hint?: string; onSelect: () => void }[]
  /** Lock the page to the dynamic viewport and let the page fill the space under the header. */
  fill?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [command, setCommand] = useState(false)
  // each lazy panel mounts on its first open and then stays mounted so Radix can run its close
  const [used, setUsed] = useState({ menu: false, settings: false, command: false })
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const { t } = useTranslation('common')
  const touch = (key: keyof typeof used) => setUsed((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  useEffect(() => {
    const close = () => setSettings(false)
    window.addEventListener('ma-close-settings', close)
    return () => window.removeEventListener('ma-close-settings', close)
  }, [])
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setUsed((prev) => (prev.command ? prev : { ...prev, command: true }))
        setCommand((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <AppSettingsSlot.Provider value={{ slot, setSlot }}>
      <div className={cn('relative flex w-full max-w-full flex-col overflow-x-clip', fill ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
        <a href="#main-content" className="ma-skip-link">
          {t('skipToContent')}
        </a>
        <header className={cn('ma-header z-40 shrink-0 border-b border-line/80 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-md', fill ? 'relative' : 'sticky top-0')}>
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
            {sites.length ? (
              <SiteSwitcher sites={sites} />
            ) : brand ? (
              <a href={brand.href} className="min-w-0 truncate font-semibold tracking-tight hover:opacity-80">
                {brand.label}
              </a>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {actions}
              <ThemeToggle />
              {nav.length ? (
                <IconButton
                  label={t('openMenu')}
                  onPointerEnter={preloadExtras}
                  onFocus={preloadExtras}
                  onClick={() => {
                    touch('menu')
                    setOpen(true)
                  }}
                >
                  <Menu className="size-4" />
                </IconButton>
              ) : null}
              <IconButton
                label={t('settings')}
                onPointerEnter={preloadSettings}
                onFocus={preloadSettings}
                onClick={() => {
                  touch('settings')
                  setSettings(true)
                }}
              >
                <Settings className="size-4" />
              </IconButton>
            </div>
          </div>
        </header>
        {used.menu ? (
          <Deferred>
            <Sheet open={open} onOpenChange={setOpen} title={t('menu')}>
              <nav className="flex flex-col gap-1" aria-label={t('menu')}>
                {nav.map((item) => (
                  <a
                    key={item.href + item.label}
                    href={item.href}
                    className="cursor-pointer rounded-sm px-2 py-2.5 text-sm transition hover:-translate-y-px hover:bg-surface-2 active:translate-y-0"
                    onClick={() => setOpen(false)}
                    {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </Sheet>
          </Deferred>
        ) : null}
        {used.settings ? (
          <Deferred>
            <Sheet open={settings} onOpenChange={setSettings} title={t('settings')}>
              <Deferred>
                <AccountSettings />
              </Deferred>
            </Sheet>
          </Deferred>
        ) : null}
        {used.command ? (
          <Deferred>
            <CommandDialog items={commandItems} open={command} onOpenChange={setCommand} />
          </Deferred>
        ) : null}
        <main id="main-content" tabIndex={-1} className={cn('mx-auto w-full max-w-6xl outline-none', fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-w-0 flex-1 px-4 py-6 sm:py-10')}>{children}</main>
      </div>
    </AppSettingsSlot.Provider>
  )
}
