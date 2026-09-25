import { loadProjects, type Project } from '@ma/content'
import { Badge, Card, PageHeader } from '@ma/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

function localized(project: Project, ru: boolean) {
  return {
    title: ru && project.titleRu ? project.titleRu : project.title,
    summary: ru && project.summaryRu ? project.summaryRu : project.summary,
  }
}

export function ListPage() {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const projects = useMemo(() => loadProjects(), [])
  const tags = [...new Set(projects.flatMap((p) => p.tags))].sort()
  const [tag, setTag] = useState<string | null>(null)
  const shown = tag ? projects.filter((p) => p.tags.includes(tag)) : projects
  return (
    <div>
      <PageHeader eyebrow="projects.ma.cyou" title={t('projects')} lead={t('projectsLead')} />
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTag(null)} className="rounded-full bg-surface-2 px-3 py-1 text-xs">{t('all')}</button>
        {tags.map((item) => (
          <button key={item} type="button" onClick={() => setTag(item)} className="rounded-full bg-surface-2 px-3 py-1 text-xs">
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((project) => (
          <Link key={project.slug} to={`/p/${project.slug}`} className="block transition hover:-translate-y-0.5">
            <Card>
              <div className="mb-2 flex flex-wrap gap-2">
                {project.tags.slice(0, 3).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <h2 className="text-lg font-medium">{localized(project, ru).title}</h2>
              <p className="mt-2 text-sm text-muted">{localized(project, ru).summary}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
