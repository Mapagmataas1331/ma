import { Menu, Moon, Settings, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
}: {
  brand: { href: string; label: string }
  nav: NavLink[]
  actions?: ReactNode
  children: ReactNode
  commandItems?: { id: string; label: string; hint?: string; onSelect: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const { t } = useTranslation('common')
  return (
    <AppSettingsSlot.Provider value={{ slot, setSlot }}>
    <CommandProvider items={commandItems}>
      <div className="relative min-h-dvh">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 left-1/2 size-80 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/70 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <a href={brand.href} className="font-semibold tracking-tight">
              {brand.label}
            </a>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {nav.map((item) => (
                <a key={item.href + item.label} href={item.href} className="rounded-sm px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg" {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              {actions}
              <ThemeToggle />
              <IconButton label={t('openMenu')} className="md:hidden" onClick={() => setOpen(true)}>
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
        <main className={cn('mx-auto w-full max-w-6xl px-4 py-10')}>{children}</main>
      </div>
    </CommandProvider>
    </AppSettingsSlot.Provider>
  )
}
