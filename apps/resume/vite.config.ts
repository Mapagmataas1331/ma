import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { appViteDefaults, i18nPreloadPlugin, notFoundPlugin, sitemapPlugin } from '@ma/config/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  ...appViteDefaults(5174),
  plugins: [react(), tailwindcss(), i18nPreloadPlugin(), notFoundPlugin(), sitemapPlugin('https://me.ma.cyou', ['/'])],
})
