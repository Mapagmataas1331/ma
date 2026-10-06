import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, type SiteLink } from '@ma/ui/shell'
import { SkyBackdrop } from '@ma/ui/sky-backdrop'
import { ThemeProvider } from '@ma/ui/theme'
import { StrictMode, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { loadProjects } from '@ma/content'
import { DetailPage } from './routes/detail'
import { ListPage } from './routes/list'
import './styles.css'

const origins = {
  home: import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou',
  resume: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou',
  projects: import.meta.env.VITE_APP_ORIGIN_PROJECTS || (typeof location !== 'undefined' ? location.origin : 'https://projects.ma.cyou'),
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
  const { t, i18n } = useTranslation('common')
  const sites = useSites('projects')
  const ru = i18n.language.startsWith('ru')
  const projects = loadProjects()
  return (
    <AppShell
      sites={sites}
      nav={[{ href: '/', label: t('all') }]}
      actions={<LanguageSwitch />}
      commandItems={[
        ...sites.map((site) => ({ id: `site-${site.short}`, label: site.label, onSelect: () => window.location.assign(site.href) })),
        { id: 'all', label: t('all'), onSelect: () => window.location.assign('/') },
        ...projects.map((project) => ({
          id: project.slug,
          label: ru && project.titleRu ? project.titleRu : project.title,
          onSelect: () => window.location.assign(`/p/${project.slug}`),
        })),
      ]}
    >
      <SkyBackdrop scene="projects" />
      {children}
    </AppShell>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <Shell><ListPage /></Shell> },
  { path: '/p/:slug', element: <Shell><DetailPage /></Shell> },
])

const root = document.getElementById('root')
if (!root) throw new Error('root missing')

// No <Toaster />: nothing on these pages raises a toast (the Lightbox share fallback lives on the resume site).
void createI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  )
})
