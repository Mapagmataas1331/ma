import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { appViteDefaults, i18nPreloadPlugin, notFoundPlugin, sitemapPlugin } from '@ma/config/vite'
import { defineConfig } from 'vite'

const defaults = appViteDefaults(5173)

export default defineConfig({
  ...defaults,
  build: {
    ...defaults.build,
    rollupOptions: {
      output: {
        // React changes far less often than app code; a separate long-cached chunk survives app deploys.
        manualChunks: (id) => (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ? 'react' : undefined),
      },
    },
  },
  plugins: [react(), tailwindcss(), i18nPreloadPlugin(), notFoundPlugin(['/dev/gallery']), sitemapPlugin('https://ma.cyou', ['/'])],
})
