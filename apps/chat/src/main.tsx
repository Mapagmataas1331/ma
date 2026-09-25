import { createI18n, LanguageSwitch } from '@ma/i18n'
import { AppShell, ThemeProvider, Toaster } from '@ma/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ChatApp } from './routes/app'
import './styles.css'

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw-push.js')
}

const home = import.meta.env.VITE_APP_ORIGIN_HOME || 'https://ma.cyou'
const queryClient = new QueryClient()

function Shell() {
  return (
    <AppShell brand={{ href: '/', label: 'chat.ma.cyou' }} nav={[{ href: home, label: 'ma.cyou', external: true }]} actions={<LanguageSwitch />}>
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
