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
  return (
    <AppShell
      brand={{ href: home, label: 'me.ma.cyou' }}
      nav={[
        { href: '#about', label: t('about') },
        { href: '#experience', label: t('experience') },
        { href: '#projects', label: t('projects') },
        { href: '#contact', label: t('contact') },
        { href: projects, label: t('allProjects'), external: true },
      ]}
      actions={<LanguageSwitch />}
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
