import { parseFrontMatter } from './frontmatter'
import {
  projectDetailSchema,
  projectSchema,
  resumeSchema,
  socialsSchema,
  type Project,
  type ProjectDetail,
  type ProjectImage,
  type ProjectLink,
  type Resume,
  type Social,
} from './schema'
import resumeEn from './resume.en.json'
import resumeRu from './resume.ru.json'
import socialsJson from './socials.json'

// Frontmatter only (title, summary, tags, year, links, gallery images): bundled with the app.
const modules = import.meta.glob('./projects/*.md', { query: '?raw', import: 'default', eager: true })
// Features, stack and the long text: one lazy chunk per project.
const details = import.meta.glob<string>('./projects/details/*.md', { query: '?raw', import: 'default' })

export function loadResume(lang: 'en' | 'ru'): Resume {
  return resumeSchema.parse(lang === 'ru' ? resumeRu : resumeEn)
}

export function loadSocials(): Social[] {
  return socialsSchema.parse(socialsJson)
}

let projects: Project[] | undefined

export function loadProjects(): Project[] {
  projects ??= Object.values(modules)
    .map((raw) => projectSchema.parse(parseFrontMatter(String(raw)).data))
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
  return projects
}

const detailCache = new Map<string, ProjectDetail>()
const detailPending = new Map<string, Promise<ProjectDetail | null>>()

export function parseProjectDetail(raw: string): ProjectDetail {
  const parsed = parseFrontMatter(raw)
  const [body = '', bodyRu = ''] = parsed.content.split(/\r?\n?<!--\s*ru\s*-->\r?\n?/)
  return projectDetailSchema.parse({ ...parsed.data, body: body.trim(), bodyRu: bodyRu.trim() })
}

/** The detail chunk if it has already loaded, so revisits and prev/next render without a loading state. */
export function peekProjectDetail(slug: string): ProjectDetail | undefined {
  return detailCache.get(slug)
}

/** Loads (once) the per-project chunk with features, stack and the long text. Resolves to null for an unknown slug. */
export function loadProjectDetail(slug: string): Promise<ProjectDetail | null> {
  const cached = detailCache.get(slug)
  if (cached) return Promise.resolve(cached)
  let pending = detailPending.get(slug)
  if (!pending) {
    const load = details[`./projects/details/${slug}.md`]
    pending = load
      ? load().then((raw) => {
          const detail = parseProjectDetail(raw)
          detailCache.set(slug, detail)
          return detail
        })
      : Promise.resolve(null)
    // a failed chunk (offline, new deploy) can be retried on the next call
    pending.catch(() => detailPending.delete(slug))
    detailPending.set(slug, pending)
  }
  return pending
}

export { projectDetailSchema, projectSchema, resumeSchema, socialsSchema }
export { projectSlugs } from './slugs'
export type { Project, ProjectDetail, ProjectImage, ProjectLink, Resume, Social }
