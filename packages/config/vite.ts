import { readFileSync } from 'node:fs'
import type { Connect, Plugin, UserConfig } from 'vite'
import type { ServerResponse } from 'node:http'

const notFoundPage = readFileSync(new URL('./404.html', import.meta.url), 'utf8')

export function sitemapPlugin(hostname: string, routes: string[]): Plugin {
  const host = hostname.replace(/\/$/, '')
  return {
    name: 'ma-sitemap',
    apply: 'build',
    generateBundle() {
      const body = routes
        .map((route) => {
          const path = route.startsWith('/') ? route : `/${route}`
          return `  <url><loc>${host}${path}</loc></url>`
        })
        .join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
      })
    },
  }
}

/** Serves 404.html for unknown paths. Known app routes still rewrite to index.html. */
export function notFoundPlugin(spaRoutes: string[] = []): Plugin {
  const allow = new Set(spaRoutes.map((route) => (route.startsWith('/') ? route : `/${route}`)))
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const path = (req.url ?? '/').split('?')[0] ?? '/'
    if (path === '/' || path === '/index.html' || allow.has(path)) return next()
    if (path.includes('.') || path.startsWith('/@') || path.startsWith('/src') || path.startsWith('/node_modules')) return next()
    const response = res as ServerResponse
    response.statusCode = 404
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end(req.method === 'HEAD' ? undefined : notFoundPage)
  }
  return {
    name: 'ma-404',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '404.html', source: notFoundPage })
    },
  }
}

export function appViteDefaults(port: number): UserConfig {
  return {
    server: { host: '0.0.0.0', port, strictPort: true },
    preview: { port, strictPort: true },
    build: { sourcemap: false, target: 'es2023' },
  }
}
