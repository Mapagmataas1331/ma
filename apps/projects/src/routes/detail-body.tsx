import type { Project, ProjectDetail } from '@ma/content'
import { Badge } from '@ma/ui/layout'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-markdown'
import { CheckIcon } from './media'

/**
 * Features, stack and the long text of a project page. Lazy-loaded with react-markdown, so the
 * projects list and the detail hero render without either.
 */
export function DetailBody({ project, detail }: { project: Project; detail: ProjectDetail }) {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const features = ru && detail.featuresRu.length ? detail.featuresRu : detail.features
  const body = ru && detail.bodyRu ? detail.bodyRu : detail.body
  const stack = detail.stack.length ? detail.stack : project.tags
  return (
    <div className="project-layout">
      <aside className="project-aside">
        {features.length ? (
          <section className="project-card ma-surface ma-surface--strong rounded-lg border border-line bg-surface-1 shadow-float">
            <h2 className="project-card__title">{t('projectFeatures')}</h2>
            <ul className="space-y-2.5 text-sm leading-relaxed">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="min-w-0">{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="project-card ma-surface ma-surface--strong rounded-lg border border-line bg-surface-1 shadow-float">
          <h2 className="project-card__title">{t('projectStack')}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {stack.map((item) => (
              <li key={item}>
                <Badge>{item}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </aside>
      <div className="project-prose project-card ma-surface ma-surface--strong rounded-lg border border-line bg-surface-1 shadow-float">
        <Markdown>{body}</Markdown>
      </div>
    </div>
  )
}
