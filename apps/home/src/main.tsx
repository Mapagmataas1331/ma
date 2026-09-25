import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster } from '@ma/ui'
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
  resume: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou',
  projects: import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou',
  chat: import.meta.env.VITE_APP_ORIGIN_CHAT || 'https://chat.ma.cyou',
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('home')
  return (
    <AppShell
      brand={{ href: '/', label: 'ma.cyou' }}
      nav={[
        { href: origins.resume, label: t('resume', { ns: 'common' }), external: true },
        { href: origins.projects, label: t('projects', { ns: 'common' }), external: true },
        { href: origins.chat, label: t('chat', { ns: 'common' }), external: true },
      ]}
      actions={<LanguageSwitch />}
      commandItems={[
        { id: 'resume', label: t('resume', { ns: 'common' }), onSelect: () => window.location.assign(origins.resume) },
        { id: 'projects', label: t('projects', { ns: 'common' }), onSelect: () => window.location.assign(origins.projects) },
        { id: 'chat', label: t('chat', { ns: 'common' }), onSelect: () => window.location.assign(origins.chat) },
      ]}
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
