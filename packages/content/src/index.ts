import { parseFrontMatter } from './frontmatter'
import { projectSchema, resumeSchema, socialsSchema, type Project, type Resume, type Social } from './schema'
import resumeEn from './resume.en.json'
import resumeRu from './resume.ru.json'
import socialsJson from './socials.json'

const modules = import.meta.glob('./projects/*.md', { query: '?raw', import: 'default', eager: true })

export function loadResume(lang: 'en' | 'ru'): Resume {
  return resumeSchema.parse(lang === 'ru' ? resumeRu : resumeEn)
}

export function loadSocials(): Social[] {
  return socialsSchema.parse(socialsJson)
}

export function loadProjects(): Project[] {
  return Object.values(modules)
    .map((raw) => {
      const parsed = parseFrontMatter(String(raw))
      const [body, bodyRu = ''] = parsed.content.split(/\n?<!--\s*ru\s*-->\n?/)
      return projectSchema.parse({ ...parsed.data, body: body.trim(), bodyRu: bodyRu.trim() })
    })
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
}

export { projectSchema, resumeSchema, socialsSchema }
export type { Project, Resume, Social }
