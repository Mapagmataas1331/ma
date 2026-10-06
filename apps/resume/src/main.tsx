import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster, type SiteLink } from '@ma/ui'
import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ResumePage } from './routes/resume-page'
import './styles.css'

const origins = {
  home: import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou',
  resume: import.meta.env.VITE_APP_ORIGIN_RESUME || (typeof location !== 'undefined' ? location.origin : 'https://me.ma.cyou'),
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

function Shell() {
  const { t } = useTranslation('common')
  const sites = useSites('me')
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
      sites={sites}
      nav={[
        ...sections.map((section) => ({ href: `#${section.id}`, label: section.label })),
        { href: origins.projects, label: t('allProjects'), external: true },
      ]}
      actions={<LanguageSwitch />}
      commandItems={[
        ...sites.map((site) => ({ id: `site-${site.short}`, label: site.label, onSelect: () => window.location.assign(site.href) })),
        ...sections.map((section) => ({ id: section.id, label: section.label, onSelect: () => { window.location.hash = section.id } })),
        { id: 'all-projects', label: t('allProjects'), onSelect: () => window.location.assign(origins.projects) },
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
