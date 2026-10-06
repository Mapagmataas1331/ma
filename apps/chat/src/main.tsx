import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster, type SiteLink } from '@ma/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChatApp } from './routes/app'
import './styles.css'

const origins = {
  home: import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou',
  resume: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou',
  projects: import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou',
  chat: import.meta.env.VITE_APP_ORIGIN_CHAT || (typeof location !== 'undefined' ? location.origin : 'https://chat.ma.cyou'),
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

const queryClient = new QueryClient()

function Shell() {
  const sites = useSites('chat')
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
      <ChatApp />
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
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
