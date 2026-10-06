import { loadProjects } from '@ma/content'
import { Badge, EmptyState, PageHeader } from '@ma/ui/layout'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import Markdown from 'react-markdown'

export function DetailPage() {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const { slug } = useParams()
  const project = loadProjects().find((p) => p.slug === slug)
  if (!project) {
    return (
      <EmptyState
        title={t('notFound')}
        body={t('projectMissing')}
        action={
          <Link to="/" className="ma-focusable text-sm text-accent underline-offset-2 hover:underline">
            {t('allProjects')}
          </Link>
        }
      />
    )
  }
  const title = ru && project.titleRu ? project.titleRu : project.title
  const summary = ru && project.summaryRu ? project.summaryRu : project.summary
  const body = ru && project.bodyRu ? project.bodyRu : project.body
  return (
    <article>
      <Link to="/" className="ma-focusable inline-flex items-center gap-1 rounded-sm text-sm text-muted transition hover:text-fg">
        <span aria-hidden>←</span> {t('allProjects')}
      </Link>
      <PageHeader eyebrow={String(project.year)} title={title} lead={summary} />
      <div className="mb-6 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      {project.links.length > 0 && (
        <p className="mb-6 flex flex-wrap gap-3 text-sm">
          {project.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="ma-focusable rounded-sm text-accent underline-offset-2 hover:underline"
              {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {link.label}
            </a>
          ))}
        </p>
      )}
      <div className="ma-surface ma-surface--strong max-w-3xl overflow-x-auto rounded-lg border border-line p-5 text-sm leading-relaxed break-words shadow-float sm:p-6">
        <Markdown>{body}</Markdown>
      </div>
    </article>
  )
}
