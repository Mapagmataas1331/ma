import { loadProjects } from '@ma/content'
import { Badge, PageHeader } from '@ma/ui'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import Markdown from 'react-markdown'

export function DetailPage() {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const { slug } = useParams()
  const project = loadProjects().find((p) => p.slug === slug)
  if (!project) return <p>{t('notFound')} <Link to="/">{t('back')}</Link></p>
  const title = ru && project.titleRu ? project.titleRu : project.title
  const summary = ru && project.summaryRu ? project.summaryRu : project.summary
  const body = ru && project.bodyRu ? project.bodyRu : project.body
  return (
    <article>
      <Link to="/" className="text-sm text-muted">{t('allProjects')}</Link>
      <PageHeader eyebrow={String(project.year)} title={title} lead={summary} />
      <div className="mb-6 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      {project.links.length > 0 && (
        <p className="mb-6 flex flex-wrap gap-3 text-sm">
          {project.links.map((link) => (
            <a key={link.href} href={link.href} className="text-accent underline-offset-2 hover:underline">{link.label}</a>
          ))}
        </p>
      )}
      <div className="prose max-w-3xl text-sm leading-relaxed">
        <Markdown>{body}</Markdown>
      </div>
    </article>
  )
}
