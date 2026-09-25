import { appViteDefaults, notFoundPlugin, sitemapPlugin } from '@ma/config/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  ...appViteDefaults(5176),
  esbuild: { target: 'esnext' },
  optimizeDeps: {
    esbuildOptions: { target: 'esnext', supported: { 'top-level-await': true } },
  },
  build: { target: 'esnext' },
  plugins: [
    react(),
    tailwindcss(),
    notFoundPlugin(),
    sitemapPlugin('https://chat.ma.cyou', ['/']),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ma.cyou chat',
        short_name: 'chat',
        start_url: '/',
        display: 'standalone',
        background_color: '#12141c',
        theme_color: '#12141c',
        icons: [
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\//],
        runtimeCaching: [],
      },
    }),
  ],
})
