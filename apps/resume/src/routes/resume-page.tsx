import { loadResume } from '@ma/content'
import { Lightbox } from '@ma/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function ResumePage() {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'
  const data = loadResume(lang)
  const [shot, setShot] = useState<{ src: string; alt: string; caption: string } | null>(null)
  return (
    <article className="mx-auto max-w-3xl">
      <header>
        <div className="flex items-center gap-4 sm:gap-6">
          <button type="button" className="size-24 shrink-0 overflow-hidden rounded-lg sm:size-32" onClick={() => setShot({ src: data.profile.photo, alt: data.profile.name, caption: data.profile.name })}>
            <img src={data.profile.photo} alt={data.profile.name} className="size-full object-cover object-[center_28%]" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent">{data.profile.eyebrow}</p>
            <h1 className="mt-2 text-[clamp(2rem,8vw,3.25rem)] leading-none font-semibold tracking-tight">{data.profile.name}</h1>
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">{data.profile.lead}</p>
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {data.profile.chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-5 min-[420px]:grid-cols-3">
          {data.profile.stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="font-medium break-words">{stat.value}</dt>
              <dd className="mt-1 text-sm text-muted">{stat.label}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-5 space-y-1.5 text-sm">
          {data.profile.facts.map((fact) => (
            <div key={fact.label} className="flex flex-wrap gap-x-2">
              <dt className="text-muted">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Section title={data.aboutTitle} id="about">
        {data.about.map((p) => (
          <p key={p.slice(0, 24)} className="mb-3 max-w-3xl leading-relaxed text-muted">{p}</p>
        ))}
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {data.highlights.map((h) => (
            <div key={h.title} className="min-w-0">
              <p className="font-medium">{h.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{h.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={data.experienceTitle} id="experience">
        {data.experience.map((job) => (
          <article key={job.org} className="border-b border-line py-5 last:border-b-0">
            <h3 className="text-lg font-medium">{job.org}</h3>
            <p className="mt-1 text-sm text-muted">{job.period}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              {job.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </article>
        ))}
      </Section>

      <Section title={data.educationTitle} id="education">
        {data.education.map((edu) => (
          <article key={edu.org}>
            <h3 className="font-medium">{edu.org}</h3>
            <p className="mt-1 text-sm text-muted">{edu.badge}</p>
            <p className="mt-1 text-sm text-muted">{edu.meta}</p>
            <p className="mt-2 text-sm leading-relaxed">{edu.note}</p>
          </article>
        ))}
      </Section>

      <Section title={data.projectsTitle} id="projects">
        <p className="mb-2 max-w-3xl text-sm text-muted">{data.projectsLead}</p>
        {data.projects.map((project) => (
          <article key={project.slug} className="border-b border-line py-6 last:border-b-0">
            <p className="text-xs tracking-wide text-muted uppercase">{project.tags.join(' · ')}</p>
            <h3 className="mt-1 text-lg font-medium">{project.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{project.summary}</p>
            {project.bullets.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
                {project.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {project.screenshots.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {project.screenshots.map((shotItem) => (
                  <button key={shotItem.src} type="button" className="min-w-0 text-left" onClick={() => setShot(shotItem)}>
                    <img src={shotItem.src} alt={shotItem.alt} className="aspect-video w-full rounded-md border border-line object-cover object-top" />
                    <span className="mt-1.5 block text-xs text-muted">{shotItem.caption}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </Section>

      <Section title={data.opsTitle} id="ops">
        <p className="mb-4 text-sm text-muted">{data.opsLead}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {data.ops.map((block) => (
            <div key={block.title} className="min-w-0">
              <h3 className="font-medium">{block.title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
                {block.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={data.skillsTitle} id="skills">
        <p className="mb-4 text-sm text-muted">{data.skillsLead}</p>
        <dl className="divide-y divide-line">
          {Object.entries(data.skills).map(([name, tags]) => (
            <div key={name} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium">{name}</dt>
              <dd className="text-sm leading-relaxed text-muted">{tags.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={data.contactsTitle} id="contact">
        <p className="mb-4 text-sm text-muted">{data.contactsLead}</p>
        <ul className="divide-y divide-line">
          {data.contacts.map((c) => (
            <li key={c.href}>
              <a href={c.href} className="block py-3">
                <span className="text-sm text-muted">{c.label}</span>
                <span className="mt-0.5 block font-medium break-all">{c.value}</span>
                <span className="block text-sm text-muted">{c.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {shot ? <Lightbox src={shot.src} alt={shot.alt} caption={shot.caption} onClose={() => setShot(null)} /> : null}
    </article>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 border-t border-line pt-8">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
