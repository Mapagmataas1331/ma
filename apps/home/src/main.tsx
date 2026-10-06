import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, type SiteLink } from '@ma/ui/shell'
import { ThemeProvider } from '@ma/ui/theme'
import { lazy, StrictMode, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { HomePage } from './routes/home-page'
import './styles.css'

const origins = {
  home: import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou',
  resume: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou',
  projects: import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou',
  chat: import.meta.env.VITE_APP_ORIGIN_CHAT || 'https://chat.ma.cyou',
}

function useSites(current: '@' | 'me' | 'projects' | 'chat'): SiteLink[] {
  const { t } = useTranslation('common')
  return [
    { short: '@', label: t('home'), href: origins.home, current: current === '@' },
    { short: 'me', label: t('resume'), href: origins.resume, current: current === 'me' },
    { short: 'projects', label: t('projects'), href: origins.projects, current: current === 'projects' },
    { short: 'chat', label: t('chat'), href: origins.chat, current: current === 'chat' },
  ]
}

function Shell({ children }: { children: ReactNode }) {
  const sites = useSites('@')
  return (
    <AppShell
      fill
      sites={sites}
      nav={[]}
      actions={<LanguageSwitch />}
      commandItems={sites.map((site) => ({
        id: site.short,
        label: site.label,
        onSelect: () => window.location.assign(site.href),
      }))}
    >
      {children}
    </AppShell>
  )
}

// dev-only component gallery: its own chunk, never fetched by the homepage
const GalleryPage = lazy(() => import('./routes/gallery').then((m) => ({ default: m.GalleryPage })))

// Two fixed paths do not need a router: dropping react-router takes ~45 KB gzip off the first load.
// Anything else never reaches this bundle (the host serves 404.html; see notFoundPlugin / _redirects).
const page = window.location.pathname.replace(/\/+$/, '') === '/dev/gallery' ? (
  <Suspense fallback={null}>
    <GalleryPage />
  </Suspense>
) : (
  <HomePage />
)

const root = document.getElementById('root')
if (!root) throw new Error('root missing')

// Waits for the active language's `common` strings, which the pre-paint script in index.html has
// already started preloading. No <Toaster />: nothing on the homepage raises a toast.
void createI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <Shell>{page}</Shell>
      </ThemeProvider>
    </StrictMode>,
  )
})
