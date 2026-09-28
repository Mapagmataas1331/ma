import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster } from '@ma/ui'
import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ResumePage } from './routes/resume-page'
import './styles.css'

const home = import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou'
const projects = import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou'

function Shell() {
  const { t } = useTranslation('common')
  const sections = [
    { id: 'about', label: t('about') },
    { id: 'experience', label: t('experience') },
    { id: 'education', label: t('education') },
    { id: 'projects', label: t('projects') },
    { id: 'ops', label: t('infrastructure') },
    { id: 'skills', label: t('skills') },
    { id: 'contact', label: t('contact') },
  ]
  return (
    <AppShell
      brand={{ href: '/', label: 'me.ma.cyou' }}
      nav={[
        { href: home, label: 'ma.cyou', external: true },
        ...sections.map((section) => ({ href: `#${section.id}`, label: section.label })),
        { href: projects, label: t('allProjects'), external: true },
      ]}
      actions={<LanguageSwitch />}
      commandItems={[
        ...sections.map((section) => ({ id: section.id, label: section.label, onSelect: () => { window.location.hash = section.id } })),
        { id: 'home', label: 'ma.cyou', onSelect: () => window.location.assign(home) },
        { id: 'all-projects', label: t('allProjects'), onSelect: () => window.location.assign(projects) },
      ]}
    >
      <ResumePage />
    </AppShell>
  )
}

const router = createBrowserRouter([{ path: '/', element: <Shell /> }])
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
