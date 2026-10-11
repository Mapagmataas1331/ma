// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clip, ogImage, renderHead, sitemapXml } from './vite'

const template = `<html><head>
    <title>old</title>
    <meta name="description" content="old" />
    <meta property="og:url" content="https://x.test/" />
    <meta property="og:title" content="old" />
    <meta name="twitter:title" content="old" />
    <link rel="canonical" href="https://x.test/" />
  </head><body></body></html>`

describe('renderHead', () => {
  const html = renderHead(template, 'https://x.test', {
    path: '/p/a',
    title: 'A & "B" · x',
    description: 'About <a>',
    image: ogImage('projects', 'A', 'sub'),
    jsonLd: [{ '@type': 'Thing', name: '</script><x>' }],
  })

  it('replaces title, description, canonical and social tags', () => {
    expect(html).toContain('<title>A &amp; "B" · x</title>')
    expect(html).toContain('<meta name="description" content="About &lt;a&gt;" />')
    expect(html).toContain('<link rel="canonical" href="https://x.test/p/a" />')
    expect(html).toContain('<meta property="og:url" content="https://x.test/p/a" />')
    expect(html).toContain('<meta property="og:title" content="A &amp; &quot;B&quot; · x" />')
    expect(html).toContain('<meta property="og:image" content="https://api.ma.cyou/v1/og?site=projects&amp;title=A&amp;subtitle=sub" />')
    expect(html.match(/og:title/g)).toHaveLength(1)
    expect(html).not.toContain('content="old"')
  })

  it('emits JSON-LD that cannot close its script tag', () => {
    expect(html).toContain('<script type="application/ld+json">{"@type":"Thing","name":"\\u003c/script>\\u003cx>"}</script>')
  })

  it('marks noindex pages and leaves them out of the sitemap', () => {
    expect(renderHead(template, 'https://x.test', { path: '/d', title: 't', description: 'd', noindex: true })).toContain('<meta name="robots" content="noindex" />')
    const xml = sitemapXml('https://x.test/', [
      { path: '/', title: '', description: '', lastmod: '2026-10-01' },
      { path: '/d', title: '', description: '', noindex: true },
    ])
    expect(xml).toContain('<url><loc>https://x.test/</loc><lastmod>2026-10-01</lastmod></url>')
    expect(xml).not.toContain('/d<')
  })
})

describe('clip', () => {
  it('cuts on a word boundary', () => {
    expect(clip('alpha beta gamma delta', 18)).toBe('alpha beta gamma…')
    expect(clip('short', 12)).toBe('short')
  })
})
