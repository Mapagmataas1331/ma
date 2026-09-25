import { appViteDefaults, notFoundPlugin, sitemapPlugin } from '@ma/config/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const routes = [
  '/',
  '/p/db-configs',
  '/p/db-plots',
  '/p/redis-grafana',
  '/p/reverse-proxy',
  '/p/pocketcam',
  '/p/chat',
]

export default defineConfig({
  ...appViteDefaults(5175),
  plugins: [react(), tailwindcss(), notFoundPlugin(routes), sitemapPlugin('https://projects.ma.cyou', routes)],
})
