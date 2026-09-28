import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster } from '@ma/ui'
import { StrictMode, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { loadProjects } from '@ma/content'
import { DetailPage } from './routes/detail'
import { ListPage } from './routes/list'
import './styles.css'

const home = import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou'

function Shell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const projects = loadProjects()
  return (
    <AppShell
      brand={{ href: '/', label: 'projects.ma.cyou' }}
      nav={[{ href: home, label: 'ma.cyou', external: true }, { href: '/', label: t('all') }]}
      actions={<LanguageSwitch />}
      commandItems={[
        { id: 'all', label: t('all'), onSelect: () => window.location.assign('/') },
        { id: 'home', label: 'ma.cyou', onSelect: () => window.location.assign(home) },
        ...projects.map((project) => ({
          id: project.slug,
          label: ru && project.titleRu ? project.titleRu : project.title,
          onSelect: () => window.location.assign(`/p/${project.slug}`),
        })),
      ]}
    >
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

void createI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </StrictMode>,
  )
})
