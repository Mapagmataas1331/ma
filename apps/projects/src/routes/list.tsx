import { loadProjects, type Project } from '@ma/content'
import { Badge, Card, EmptyState, PageHeader } from '@ma/ui/layout'
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
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('filterByTag')}>
        <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)} className={`ma-chip ${tag === null ? 'ma-chip--active' : 'ma-chip--idle'}`}>
          {t('all')}
        </button>
        {tags.map((item) => (
          <button key={item} type="button" aria-pressed={tag === item} onClick={() => setTag(item)} className={`ma-chip ${tag === item ? 'ma-chip--active' : 'ma-chip--idle'}`}>
            {item}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t('nothingMatches')} body={t('projectsFilterEmpty')} action={<button type="button" className="ma-focusable text-sm text-accent underline-offset-2 hover:underline" onClick={() => setTag(null)}>{t('showAllProjects')}</button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((project) => (
            <Link key={project.slug} to={`/p/${project.slug}`} className="ma-card-link group block">
              <Card className="h-full">
                <div className="mb-2 flex flex-wrap gap-2">
                  {project.tags.slice(0, 3).map((tagName) => (
                    <Badge key={tagName}>{tagName}</Badge>
                  ))}
                </div>
                <h2 className="flex items-baseline gap-2 text-lg font-medium tracking-tight break-words">
                  <span className="min-w-0 flex-1">{localized(project, ru).title}</span>
                  <span className="ma-card-arrow shrink-0 text-base text-muted" aria-hidden>
                    →
                  </span>
                </h2>
                <p className="mt-1 font-mono text-xs text-muted tabular-nums">{project.year}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted break-words">{localized(project, ru).summary}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
