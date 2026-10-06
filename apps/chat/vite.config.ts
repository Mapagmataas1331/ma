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
  build: {
    target: 'esnext',
    // libsodium-wrappers-sumo alone is ~1.5–2 MiB; keep the Vite warning threshold just above that.
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('libsodium')) return 'sodium'
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react'
          }
          if (id.includes('node_modules/dexie')) return 'dexie'
          if (id.includes('@tanstack/react-query')) return 'query'
          if (
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react-i18next') ||
            id.includes('node_modules/i18next')
          ) {
            return 'router-i18n'
          }
          if (id.includes('node_modules/lucide-react')) return 'icons'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    notFoundPlugin(),
    sitemapPlugin('https://chat.ma.cyou', ['/']),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'Chat',
        short_name: 'Chat',
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
        // Take control immediately so iOS can subscribe to push on first launch (Discourse hit).
        skipWaiting: true,
        clientsClaim: true,
        // Safety margin so the sodium chunk stays precached for offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\//],
        runtimeCaching: [],
        importScripts: ['sw-push.js'],
      },
    }),
  ],
})
