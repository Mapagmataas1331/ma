import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { appViteDefaults, gitLastModified, i18nPreloadPlugin, notFoundPlugin, ogImage, person, seoPagesPlugin } from '@ma/config/vite'
import { defineConfig } from 'vite'

const defaults = appViteDefaults(5173)
const description = 'Timofey (Mapagmataas): personal site with a résumé, projects, PocketCam and an invite-only end-to-end encrypted chat.'

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
  plugins: [
    react(),
    tailwindcss(),
    i18nPreloadPlugin(),
    notFoundPlugin(['/dev/gallery']),
    // writes dist/index.html head tags, dist/dev/gallery.html (noindex) and sitemap.xml (packages/config/seo.ts)
    seoPagesPlugin('https://ma.cyou', [
      {
        path: '/',
        title: 'Timofey - Mapagmataas · ma.cyou',
        description,
        ogTitle: 'ma.cyou',
        ogDescription: 'Resume, projects, and a quiet messenger.',
        image: ogImage('home'),
        lastmod: gitLastModified(['apps/home/src', 'apps/home/index.html']),
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': 'https://ma.cyou/#website',
            name: 'ma.cyou',
            url: 'https://ma.cyou/',
            description,
            inLanguage: ['en', 'ru'],
            author: { '@id': person['@id'] },
          },
          { '@context': 'https://schema.org', ...person },
        ],
      },
      { path: '/dev/gallery', title: 'Component gallery · ma.cyou', description: 'Internal UI component gallery.', noindex: true },
    ]),
  ],
})
