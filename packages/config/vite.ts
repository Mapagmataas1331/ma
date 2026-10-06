import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Connect, HtmlTagDescriptor, Plugin, UserConfig } from 'vite'
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

const localHost = /\b(localhost|127\.0\.0\.1|\[::1\])\b/

/** Adds `origin` and its ws/wss twin to every connect-src directive in a _headers file. */
export function addConnectSrc(headers: string, origin: string): string {
  const url = new URL(origin)
  const ws = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  return headers.replace(/^(\s*Content-Security-Policy:.*)$/gim, (line) =>
    line.replace(/connect-src[^;\r\n]*/, (directive) => {
      const have = directive.split(/\s+/)
      const extra = [url.origin, ws].filter((source) => !have.includes(source))
      return [directive, ...extra].join(' ')
    }),
  )
}

/**
 * public/_headers is the production CSP and must not allow localhost. Vite dev never reads it.
 * When a build sets VITE_API_ORIGIN (e.g. http://localhost:8080 for `wrangler dev`), that origin
 * is added to connect-src in dist/_headers only. A default build fails if localhost slips back in.
 */
export function cspApiOriginPlugin(): Plugin {
  let outDir = ''
  let origin = ''
  return {
    name: 'ma-csp-api-origin',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      origin = (config.env.VITE_API_ORIGIN ?? '').trim()
    },
    closeBundle() {
      const file = join(outDir, '_headers')
      if (!existsSync(file)) return
      const headers = readFileSync(file, 'utf8')
      if (origin) {
        writeFileSync(file, addConnectSrc(headers, origin))
        return
      }
      const csp = headers.split(/\r?\n/).filter((line) => /content-security-policy/i.test(line))
      if (csp.some((line) => localHost.test(line))) {
        throw new Error('public/_headers CSP allows localhost; production headers must not. Set VITE_API_ORIGIN for local builds instead.')
      }
    },
  }
}

/**
 * Lets index.html preload the right language before any JS runs. @ma/i18n loads its `common`
 * strings per language with a dynamic import, which the browser would only discover after the
 * entry chunk has executed. This writes the hashed chunk URLs into
 * <meta name="ma-i18n" content="en=…&ru=…&font-latin=…&font-ru=…">, and the inline pre-paint script in
 * each app's index.html (CSP-pinned by hash in public/_headers) adds <link rel="modulepreload"> for
 * the active language plus a font preload for its Inter subset. Without the meta (dev) nothing happens.
 */
export function i18nPreloadPlugin(): Plugin {
  let base = '/'
  return {
    name: 'ma-i18n-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        const urls = new URLSearchParams()
        for (const item of Object.values(ctx.bundle)) {
          if (item.type === 'chunk') {
            const lang = /[\\/]locales[\\/](en|ru)[\\/]common\.json$/.exec(item.facadeModuleId ?? '')?.[1]
            if (lang) urls.set(lang, base + item.fileName)
          } else if (/inter-latin-wght-normal-[\w-]+\.woff2$/.test(item.fileName)) {
            urls.set('font-latin', base + item.fileName)
          } else if (/inter-cyrillic-wght-normal-[\w-]+\.woff2$/.test(item.fileName)) {
            urls.set('font-ru', base + item.fileName)
          }
        }
        if (!urls.has('en') || !urls.has('ru')) return
        const tags: HtmlTagDescriptor[] = [{ tag: 'meta', attrs: { name: 'ma-i18n', content: urls.toString() }, injectTo: 'head-prepend' }]
        // Latin covers the wordmark and nav in both languages, so it is always worth fetching early.
        const latin = urls.get('font-latin')
        if (latin) tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: latin, crossorigin: '' }, injectTo: 'head' })
        return tags
      },
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
