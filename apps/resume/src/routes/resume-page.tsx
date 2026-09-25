import { loadResume } from '@ma/content'
import { Badge, Card, Lightbox, PageHeader } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function ResumePage() {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'
  const data = loadResume(lang)
  const [shot, setShot] = useState<{ src: string; alt: string; caption: string } | null>(null)
  return (
    <article>
      <PageHeader eyebrow={data.profile.eyebrow} title={data.profile.name} lead={data.profile.lead} />
      <div className="mb-10 grid gap-6 md:grid-cols-[1.4fr_.8fr]">
        <div>
          <ul className="space-y-1 text-sm text-muted">
            {data.profile.chips.map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
          <dl className="mt-4 grid w-full gap-3 sm:grid-cols-3">
            {data.profile.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-medium">{stat.value}</dt>
                <dd className="text-sm text-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Card>
          <button type="button" className="block w-full" onClick={() => setShot({ src: data.profile.photo, alt: data.profile.name, caption: data.profile.name })}>
            <img src={data.profile.photo} alt={data.profile.name} className="aspect-[4/5] w-full rounded-md object-cover" />
          </button>
          <ul className="mt-4 space-y-2 text-sm">
            {data.profile.facts.map((fact) => (
              <li key={fact.label} className="flex justify-between gap-3">
                <span className="text-muted">{fact.label}</span>
                <span>{fact.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <section id="about" className="mb-12">
        <h2 className="mb-3 text-2xl font-semibold">{data.aboutTitle}</h2>
        {data.about.map((p) => (
          <p key={p.slice(0, 24)} className="mb-3 max-w-3xl leading-relaxed text-muted">{p}</p>
        ))}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.highlights.map((h) => (
            <Card key={h.title}>
              <p className="font-medium">{h.title}</p>
              <p className="mt-1 text-sm text-muted">{h.body}</p>
            </Card>
          ))}
        </div>
      </section>
      <section id="experience" className="mb-12">
        <h2 className="mb-3 text-2xl font-semibold">{data.experienceTitle}</h2>
        {data.experience.map((job) => (
          <Card key={job.org} className="mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-medium">{job.org}</h3>
              <p className="text-sm text-muted">{job.period}</p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {job.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
      <section id="education" className="mb-12">
        <h2 className="mb-3 text-2xl font-semibold">{data.educationTitle}</h2>
        {data.education.map((edu) => (
          <Card key={edu.org}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{edu.org}</h3>
              <Badge>{edu.badge}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{edu.meta}</p>
            <p className="mt-2 text-sm">{edu.note}</p>
          </Card>
        ))}
      </section>
      <section id="projects" className="mb-12">
        <h2 className="mb-2 text-2xl font-semibold">{data.projectsTitle}</h2>
        <p className="mb-4 max-w-3xl text-sm text-muted">{data.projectsLead}</p>
        <div className="space-y-4">
          {data.projects.map((project) => (
            <Card key={project.slug}>
              <div className="mb-2 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <h3 className="text-lg font-medium">{project.title}</h3>
              <p className="mt-2 text-sm text-muted">{project.summary}</p>
              {project.bullets.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {project.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {project.screenshots.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {project.screenshots.map((shotItem) => (
                    <button key={shotItem.src} type="button" className="text-left" onClick={() => setShot(shotItem)}>
                      <img src={shotItem.src} alt={shotItem.alt} className="rounded-md border border-line" />
                      <span className="mt-1 block text-xs text-muted">{shotItem.caption}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>
      <section id="ops" className="mb-12">
        <h2 className="mb-2 text-2xl font-semibold">{data.opsTitle}</h2>
        <p className="mb-4 text-sm text-muted">{data.opsLead}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {data.ops.map((block) => (
            <Card key={block.title}>
              <h3 className="font-medium">{block.title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {block.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <section id="skills" className="mb-12">
        <h2 className="mb-2 text-2xl font-semibold">{data.skillsTitle}</h2>
        <p className="mb-4 text-sm text-muted">{data.skillsLead}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(data.skills).map(([name, tags]) => (
            <Card key={name}>
              <h3 className="mb-2 font-medium">{name}</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section id="contact">
        <h2 className="mb-2 text-2xl font-semibold">{data.contactsTitle}</h2>
        <p className="mb-4 text-sm text-muted">{data.contactsLead}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.contacts.map((c) => (
            <a key={c.href} href={c.href} className="block">
              <Card>
                <p className="text-xs text-muted">{c.label}</p>
                <p className="font-medium">{c.value}</p>
                <p className="text-sm text-muted">{c.hint}</p>
              </Card>
            </a>
          ))}
        </div>
      </section>
      {shot ? <Lightbox src={shot.src} alt={shot.alt} caption={shot.caption} onClose={() => setShot(null)} /> : null}
    </article>
  )
}
