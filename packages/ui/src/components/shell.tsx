import { Menu, Moon, Settings, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useTheme, type ThemeMode } from '../theme'
import { useTranslation } from 'react-i18next'
import { AccountSettings, AppSettingsSlot } from './account-settings'
import { CommandProvider, IconButton, Sheet } from './primitives'

export type NavLink = { href: string; label: string; external?: boolean }

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

export function AppShell({
  brand,
  nav,
  actions,
  children,
  commandItems = [],
  fill = false,
}: {
  brand: { href: string; label: string }
  nav: NavLink[]
  actions?: ReactNode
  children: ReactNode
  commandItems?: { id: string; label: string; hint?: string; onSelect: () => void }[]
  /** Lock the page to the dynamic viewport and let the page fill the space under the header. */
  fill?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const { t } = useTranslation('common')
  useEffect(() => {
    const close = () => setSettings(false)
    window.addEventListener('ma-close-settings', close)
    return () => window.removeEventListener('ma-close-settings', close)
  }, [])
  return (
    <AppSettingsSlot.Provider value={{ slot, setSlot }}>
    <CommandProvider items={commandItems}>
      <div className={cn('relative flex w-full max-w-full flex-col overflow-x-clip', fill ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 left-1/2 size-80 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <header className={cn('z-40 shrink-0 border-b border-line/80 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-md', !fill && 'sticky top-0')}>
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
            <a href={brand.href} className="min-w-0 truncate font-semibold tracking-tight">
              {brand.label}
            </a>
            <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Primary">
              {nav.map((item) => (
                <a key={item.href + item.label} href={item.href} className="rounded-sm px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg" {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {actions}
              <ThemeToggle />
              <IconButton label={t('openMenu')} className="lg:hidden" onClick={() => setOpen(true)}>
                <Menu className="size-4" />
              </IconButton>
              <IconButton label={t('settings')} onClick={() => setSettings(true)}>
                <Settings className="size-4" />
              </IconButton>
            </div>
          </div>
        </header>
        <Sheet open={open} onOpenChange={setOpen} title={t('menu')}>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {nav.map((item) => (
              <a key={item.href + item.label} href={item.href} className="rounded-sm px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
          </nav>
        </Sheet>
        <Sheet open={settings} onOpenChange={setSettings} title={t('settings')}>
          <AccountSettings />
        </Sheet>
        <main className={cn('mx-auto w-full max-w-6xl', fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-w-0 flex-1 px-4 py-6 sm:py-10')}>{children}</main>
      </div>
    </CommandProvider>
    </AppSettingsSlot.Provider>
  )
}
