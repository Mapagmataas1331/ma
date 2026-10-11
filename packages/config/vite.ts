import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, HtmlTagDescriptor, Plugin, UserConfig } from 'vite'
import type { ServerResponse } from 'node:http'

const notFoundPage = readFileSync(new URL('./404.html', import.meta.url), 'utf8')

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

// ---- SEO ---------------------------------------------------------------------------------------

/**
 * Build-time SEO for the client-rendered apps. Crawlers and link-preview bots (Slack, Telegram,
 * X, Facebook) read the HTML the server sends and usually never run our JS, so every indexable
 * route gets its own static copy of the built index.html with the right <title>, description,
 * canonical, Open Graph / Twitter tags and JSON-LD. The React app still boots from it unchanged.
 *
 * Output layout: "/" rewrites dist/index.html in place; "/p/x" becomes dist/p/x.html, which
 * Cloudflare static assets (html_handling "auto-trailing-slash") serves at /p/x with a 200.
 * Those routes must therefore NOT also be rewritten to /index.html in public/_redirects.
 */

export interface SeoPage {
  /** Absolute path on the site, e.g. "/" or "/p/pocketcam". */
  path: string
  title: string
  description: string
  /** Shorter social title/description; default to title/description. */
  ogTitle?: string
  ogDescription?: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'profile' | 'article'
  /** JSON-LD objects; each becomes one <script type="application/ld+json"> (not executed, so no CSP hash). */
  jsonLd?: Record<string, unknown>[]
  /** YYYY-MM-DD for the sitemap. */
  lastmod?: string
  /** Kept out of the sitemap and marked noindex. */
  noindex?: boolean
}

export const ogImage = (site: 'home' | 'projects' | 'resume' | 'chat', title?: string, subtitle?: string) => {
  const q = new URLSearchParams({ site })
  if (title) q.set('title', title)
  if (subtitle) q.set('subtitle', clip(subtitle, 180))
  return `https://api.ma.cyou/v1/og?${q.toString()}`
}

/** Trims to max chars on a word boundary, adding an ellipsis when cut. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, '')}…`
}

const socials = JSON.parse(readFileSync(new URL('../content/src/socials.json', import.meta.url), 'utf8')) as { href: string }[]

/** The one person behind every ma.cyou site, for JSON-LD. Facts come from packages/content. */
export const person = {
  '@type': 'Person',
  '@id': 'https://ma.cyou/#person',
  name: 'Timofey',
  alternateName: 'Mapagmataas',
  url: 'https://ma.cyou/',
  image: 'https://me.ma.cyou/Photo.jpg',
  email: 'mailto:me@ma.cyou',
  address: { '@type': 'PostalAddress', addressLocality: 'Novosibirsk', addressCountry: 'RU' },
  sameAs: ['https://me.ma.cyou/', ...socials.map((s) => s.href).filter((href) => href.startsWith('https://'))],
} as const

export const breadcrumbs = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
})

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// JSON inside <script> must not be able to close the tag.
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Sets <meta {attr}="{key}" content="…"> (replacing an existing one) or inserts it before </head>. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string | undefined): string {
  if (value === undefined) return html
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`
  const re = new RegExp(`<meta\\s+${attr}="${escapeRe(key)}"\\s+content="[^"]*"\\s*/?>`)
  return re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => `  ${tag}\n  </head>`)
}

/** Returns index.html with the head tags of one page. Unrelated tags are left alone. */
export function renderHead(template: string, origin: string, page: SeoPage): string {
  const host = origin.replace(/\/$/, '')
  const url = host + page.path
  let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeText(page.title)}</title>`)
  html = setMeta(html, 'name', 'description', page.description)
  html = setMeta(html, 'property', 'og:type', page.type)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'property', 'og:title', page.ogTitle ?? page.title)
  html = setMeta(html, 'property', 'og:description', page.ogDescription ?? page.description)
  html = setMeta(html, 'property', 'og:image', page.image)
  html = setMeta(html, 'property', 'og:image:alt', page.imageAlt)
  html = setMeta(html, 'name', 'twitter:title', page.ogTitle ?? page.title)
  html = setMeta(html, 'name', 'twitter:description', page.ogDescription ?? page.description)
  html = setMeta(html, 'name', 'twitter:image', page.image)
  html = setMeta(html, 'name', 'twitter:image:alt', page.imageAlt)
  if (page.noindex) html = setMeta(html, 'name', 'robots', 'noindex')
  const canonical = `<link rel="canonical" href="${escapeAttr(url)}" />`
  html = /<link\s+rel="canonical"[^>]*>/.test(html)
    ? html.replace(/<link\s+rel="canonical"[^>]*>/, () => canonical)
    : html.replace('</head>', () => `  ${canonical}\n  </head>`)
  for (const data of page.jsonLd ?? []) {
    html = html.replace('</head>', () => `  <script type="application/ld+json">${safeJson(data)}</script>\n  </head>`)
  }
  return html
}

export function sitemapXml(origin: string, pages: SeoPage[]): string {
  const host = origin.replace(/\/$/, '')
  const body = pages
    .filter((page) => !page.noindex)
    .map((page) => `  <url><loc>${escapeText(host + page.path)}</loc>${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** Last commit date (YYYY-MM-DD) touching any of the paths (relative to the repo root), or undefined outside a git checkout. */
export function gitLastModified(paths: string[]): string | undefined {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : undefined
  } catch {
    return undefined
  }
}

/** Writes per-route HTML (see the top of this file) and sitemap.xml after the build. */
export function seoPagesPlugin(origin: string, pages: SeoPage[] | (() => SeoPage[])): Plugin {
  let outDir = ''
  return {
    name: 'ma-seo-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const list = typeof pages === 'function' ? pages() : pages
      const index = join(outDir, 'index.html')
      if (!existsSync(index)) return
      const template = readFileSync(index, 'utf8')
      for (const page of list) {
        if (!page.path.startsWith('/')) throw new Error(`seo page path must start with /: ${page.path}`)
        const file = page.path === '/' ? index : join(outDir, `${page.path.slice(1).replace(/\/$/, '')}.html`)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, renderHead(template, origin, page))
      }
      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(origin, list))
    },
  }
}
