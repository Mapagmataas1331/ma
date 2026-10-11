import { loadProjectDetail, loadProjects, peekProjectDetail, type Project, type ProjectDetail, type ProjectLink } from '@ma/content'
import { EmptyState } from '@ma/ui/layout'
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { projectTitle, usePageHead } from '../head'
import { Gallery } from './gallery'
import { ArrowUpRight, ChevronLeft, ChevronRight, DocIcon, DownloadIcon, GithubIcon } from './media'
import { loadDetailBody, prefetchProject } from './prefetch'

const DetailBody = lazy(() => loadDetailBody().then((module) => ({ default: module.DetailBody })))

function localized(project: Project, ru: boolean) {
  return {
    title: ru && project.titleRu ? project.titleRu : project.title,
    summary: ru && project.summaryRu ? project.summaryRu : project.summary,
  }
}

const linkIcon: Record<ProjectLink['kind'], (props: { className?: string }) => ReactNode> = {
  live: ArrowUpRight,
  github: GithubIcon,
  download: DownloadIcon,
  writeup: DocIcon,
}

export function DetailPage() {
  const { t, i18n } = useTranslation('common')
  const ru = i18n.language.startsWith('ru')
  const { slug } = useParams()
  const projects = useMemo(() => loadProjects(), [])
  const index = projects.findIndex((p) => p.slug === slug)
  const project = projects[index]
  const text = project ? localized(project, ru) : null
  // the long text, features and stack come in a per-project chunk; the hero and gallery render right away
  const [loaded, setLoaded] = useState<{ slug: string; detail: ProjectDetail | null; failed: boolean }>()
  const current = loaded?.slug === slug ? loaded : undefined
  const detail = current?.detail ?? (slug ? peekProjectDetail(slug) : undefined)
  const failed = current?.failed ?? false
  const known = Boolean(project)

  useEffect(() => {
    if (!slug || !known) return
    let live = true
    void loadDetailBody().catch(() => undefined)
    loadProjectDetail(slug).then(
      (result) => live && setLoaded({ slug, detail: result, failed: false }),
      () => live && setLoaded({ slug, detail: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [slug, known])

  useEffect(() => {
    // the router keeps the old scroll position on client-side navigation; prev/next should start at the top
    window.scrollTo({ top: 0 })
  }, [slug])
  usePageHead(text ? projectTitle(text.title) : undefined, text?.summary, `/p/${slug ?? ''}`)

  if (!project || !text) {
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
  const prev = index > 0 ? projects[index - 1] : undefined
  const next = index < projects.length - 1 ? projects[index + 1] : undefined
  return (
    <article className="project-page">
      <Link to="/" className="ma-focusable inline-flex items-center gap-1 rounded-sm text-sm text-muted transition hover:text-fg">
        <span aria-hidden>←</span> {t('allProjects')}
      </Link>

      <header className="project-hero">
        <p className="project-meta">
          <span className="font-mono tabular-nums">{project.year}</span>
          <span className={`project-status project-status--${project.status}`}>{t(`projectStatus_${project.status}`)}</span>
          <span className="text-muted">{t(`projectContext_${project.context}`)}</span>
        </p>
        <h1 className="mt-3 text-[clamp(1.9rem,6.5vw,3.25rem)] leading-[1.08] font-semibold tracking-tight text-balance break-words">{text.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg">{text.summary}</p>
        {project.links.length ? (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('projectLinks')}>
            {project.links.map((link, i) => {
              const LinkIcon = linkIcon[link.kind]
              return (
                <li key={link.href} className="min-w-0">
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`project-link ma-focusable ${i === 0 ? 'project-link--primary' : ''}`}
                  >
                    <LinkIcon className="size-4 shrink-0" />
                    <span className="truncate">{ru && link.labelRu ? link.labelRu : link.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </header>

      <Gallery images={project.images} title={text.title} />

      {detail ? (
        <Suspense fallback={<DetailSkeleton label={t('projectLoading')} />}>
          <DetailBody project={project} detail={detail} />
        </Suspense>
      ) : failed ? (
        <p className="project-card ma-surface ma-surface--strong rounded-lg border border-line bg-surface-1 text-sm text-muted shadow-float" role="alert">
          {t('projectLoadFailed')}{' '}
          <button
            type="button"
            className="ma-focusable rounded-sm text-accent underline-offset-2 hover:underline"
            // browsers remember a failed import(), so a retry has to reload the page
            onClick={() => window.location.reload()}
          >
            {t('tryAgain')}
          </button>
        </p>
      ) : (
        <DetailSkeleton label={t('projectLoading')} />
      )}

      <nav className="project-pager" aria-label={t('projectOtherNav')}>
        {prev ? <PagerLink project={prev} ru={ru} dir="prev" label={t('projectPrev')} /> : <span aria-hidden />}
        {next ? <PagerLink project={next} ru={ru} dir="next" label={t('projectNext')} /> : <span aria-hidden />}
      </nav>
    </article>
  )
}

/** Holds roughly the space of the features card and the text, so the page does not jump when they arrive. */
function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="project-layout project-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="project-aside" aria-hidden>
        <div className="project-card ma-surface rounded-lg border border-line bg-surface-1">
          <span className="project-skeleton__line w-1/3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="project-skeleton__line" />
          ))}
        </div>
      </div>
      <div className="project-card ma-surface rounded-lg border border-line bg-surface-1" aria-hidden>
        <span className="project-skeleton__line project-skeleton__line--title" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span key={i} className="project-skeleton__line" />
        ))}
      </div>
    </div>
  )
}

function PagerLink({ project, ru, dir, label }: { project: Project; ru: boolean; dir: 'prev' | 'next'; label: string }) {
  const title = localized(project, ru).title
  return (
    <Link
      to={`/p/${project.slug}`}
      className={`ma-card-link block min-w-0 project-pager__link--${dir}`}
      rel={dir}
      onPointerEnter={() => prefetchProject(project.slug)}
      onFocus={() => prefetchProject(project.slug)}
    >
      <span className="project-pager__card ma-surface rounded-lg border border-line bg-surface-1 shadow-float">
        {dir === 'prev' ? <ChevronLeft className="ma-card-arrow size-4 shrink-0 text-muted" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">{label}</span>
          <span className="block truncate font-medium">{title}</span>
        </span>
        {dir === 'next' ? <ChevronRight className="ma-card-arrow size-4 shrink-0 text-muted" /> : null}
      </span>
    </Link>
  )
}
