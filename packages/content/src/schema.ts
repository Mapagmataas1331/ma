import { z } from 'zod'

export const resumeSchema = z.object({
  profile: z.object({
    name: z.string(),
    location: z.string(),
    eyebrow: z.string(),
    lead: z.string(),
    photo: z.string(),
    chips: z.array(z.string()),
    stats: z.array(z.object({ value: z.string(), label: z.string() })),
    facts: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  aboutTitle: z.string(),
  about: z.array(z.string()),
  highlights: z.array(z.object({ title: z.string(), body: z.string() })),
  experienceTitle: z.string(),
  experience: z.array(
    z.object({
      org: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  educationTitle: z.string(),
  education: z.array(
    z.object({
      org: z.string(),
      meta: z.string(),
      badge: z.string(),
      note: z.string(),
    }),
  ),
  projectsTitle: z.string(),
  projectsLead: z.string(),
  projects: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      tags: z.array(z.string()),
      summary: z.string(),
      bullets: z.array(z.string()),
      screenshots: z.array(z.object({ src: z.string(), alt: z.string(), caption: z.string() })).default([]),
      featured: z.boolean().default(false),
    }),
  ),
  opsTitle: z.string(),
  opsLead: z.string(),
  ops: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })),
  skillsTitle: z.string(),
  skillsLead: z.string(),
  skills: z.record(z.array(z.string())),
  contactsTitle: z.string(),
  contactsLead: z.string(),
  contacts: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      href: z.string(),
      hint: z.string(),
    }),
  ),
})

export type Resume = z.infer<typeof resumeSchema>

export const projectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  year: z.number(),
  status: z.enum(['active', 'archived', 'personal']),
  featured: z.boolean().default(false),
  titleRu: z.string().default(''),
  summary: z.string(),
  summaryRu: z.string().default(''),
  links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  body: z.string(),
  bodyRu: z.string().default(''),
})

export type Project = z.infer<typeof projectSchema>

export const socialsSchema = z.array(
  z.object({
    label: z.string(),
    href: z.string(),
    hint: z.string(),
  }),
)

export type Social = z.infer<typeof socialsSchema>[number]
