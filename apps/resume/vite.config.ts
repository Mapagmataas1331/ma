import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { appViteDefaults, notFoundPlugin, sitemapPlugin } from '@ma/config/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  ...appViteDefaults(5174),
  plugins: [react(), tailwindcss(), notFoundPlugin(), sitemapPlugin('https://me.ma.cyou', ['/'])],
})
