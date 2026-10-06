import { Check, ChevronDown, Menu, Moon, Settings, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useTheme, type ThemeMode } from '../theme'
import { useTranslation } from 'react-i18next'
import { AccountSettings, AppSettingsSlot } from './account-settings'
import { CommandProvider, Dropdown, DropdownItem, IconButton, Sheet } from './primitives'

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
  const current = sites.find((site) => site.current) ?? sites[0]
  if (!current) return null
  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="group inline-flex h-9 max-w-[min(100%,14rem)] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-left transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:bg-surface-2 active:translate-y-0 active:scale-[0.98]"
          aria-label={t('sites')}
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
      }
    >
      <div className="px-2 py-1.5 text-[0.65rem] font-medium tracking-wide text-muted uppercase">{t('sites')}</div>
      {sites.map((site) => (
        <DropdownItem
          key={site.href + site.short}
          onSelect={() => {
            if (site.current) return
            window.location.assign(site.href)
          }}
        >
          <span className="flex w-full min-w-44 items-center gap-3">
            <span className={cn('w-16 shrink-0 font-mono text-xs', site.current ? 'text-accent' : 'text-muted')}>{site.short}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{site.label}</span>
            {site.current ? <Check className="size-3.5 shrink-0 text-accent" /> : null}
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
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
                <IconButton label={t('openMenu')} onClick={() => setOpen(true)}>
                  <Menu className="size-4" />
                </IconButton>
              ) : null}
              <IconButton label={t('settings')} onClick={() => setSettings(true)}>
                <Settings className="size-4" />
              </IconButton>
            </div>
          </div>
        </header>
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
        <Sheet open={settings} onOpenChange={setSettings} title={t('settings')}>
          <AccountSettings />
        </Sheet>
        <main className={cn('mx-auto w-full max-w-6xl', fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-w-0 flex-1 px-4 py-6 sm:py-10')}>{children}</main>
      </div>
    </CommandProvider>
    </AppSettingsSlot.Provider>
  )
}
