import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster, type SiteLink } from '@ma/ui'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import en from './locales/en/home.json'
import ru from './locales/ru/home.json'
import { GalleryPage } from './routes/gallery'
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

const router = createBrowserRouter([
  { path: '/', element: <Shell><HomePage /></Shell> },
  { path: '/dev/gallery', element: <Shell><GalleryPage /></Shell> },
])

const root = document.getElementById('root')
if (!root) throw new Error('root missing')

void createI18n({ home: { en, ru } }).then(() => {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </StrictMode>,
  )
})
