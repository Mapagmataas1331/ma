import { readdirSync, readFileSync } from 'node:fs'
import { appViteDefaults, breadcrumbs, clip, gitLastModified, i18nPreloadPlugin, notFoundPlugin, ogImage, person, seoPagesPlugin, type SeoPage } from '@ma/config/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { parseFrontMatter } from '../../packages/content/src/frontmatter'
import { LIST_DESCRIPTION, LIST_TITLE, ORIGIN, projectTitle } from './src/head'

const origin = ORIGIN
const contentDir = new URL('../../packages/content/src/projects/', import.meta.url)

interface ProjectMeta {
  slug: string
  title: string
  summary: string
  year: number
  tags?: string[]
  links?: { href: string; kind: string }[]
  images?: { src: string; alt: string }[]
}

// Same frontmatter the app bundles (packages/content), read at build time for the static head tags.
const projects = readdirSync(contentDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => parseFrontMatter(readFileSync(new URL(file, contentDir), 'utf8')).data as unknown as ProjectMeta)
  .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))

const listTitle = LIST_TITLE
const listDescription = LIST_DESCRIPTION

function projectPage(project: ProjectMeta): SeoPage {
  const url = `${origin}/p/${project.slug}`
  const repo = project.links?.find((link) => link.kind === 'github')?.href
  const live = project.links?.find((link) => link.kind === 'live')?.href
  const cover = project.images?.[0]
  return {
    path: `/p/${project.slug}`,
    title: projectTitle(project.title),
    description: clip(project.summary, 160),
    ogTitle: project.title,
    type: 'article',
    image: ogImage('projects', project.title, project.summary),
    imageAlt: `${project.title}: ${clip(project.summary, 120)}`,
    lastmod: gitLastModified([`packages/content/src/projects/${project.slug}.md`, `packages/content/src/projects/details/${project.slug}.md`]),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': repo ? 'SoftwareSourceCode' : 'CreativeWork',
        '@id': `${url}#project`,
        name: project.title,
        description: project.summary,
        url,
        ...(repo ? { codeRepository: repo } : {}),
        ...(live ? { sameAs: live } : {}),
        ...(cover ? { image: origin + cover.src } : {}),
        keywords: project.tags?.join(', '),
        dateCreated: String(project.year),
        author: person,
      },
      breadcrumbs([
        { name: 'Projects', url: `${origin}/` },
        { name: project.title, url },
      ]),
    ],
  }
}

const pages: SeoPage[] = [
  {
    path: '/',
    title: listTitle,
    description: listDescription,
    ogTitle: 'Projects by Timofey',
    image: ogImage('projects'),
    lastmod: gitLastModified(['packages/content/src/projects', 'apps/projects/src']),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Projects by Timofey',
        description: listDescription,
        url: `${origin}/`,
        author: person,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: projects.map((project, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}/p/${project.slug}`, name: project.title })),
        },
      },
    ],
  },
  ...projects.map(projectPage),
]

export default defineConfig({
  ...appViteDefaults(5175),
  plugins: [
    react(),
    tailwindcss(),
    i18nPreloadPlugin(),
    notFoundPlugin(pages.map((page) => page.path)),
    // per-route HTML for / and every /p/<slug>, plus sitemap.xml (see packages/config/seo.ts)
    seoPagesPlugin(origin, pages),
  ],
})
