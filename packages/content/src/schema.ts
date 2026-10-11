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
      /** `freelance` marks client work, which is not employment (kept out of the JSON-LD worksFor). */
      kind: z.enum(['job', 'freelance']).default('job'),
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

/** A screenshot or diagram under apps/projects/public. Raster images also ship a `-sm.webp` variant for cards and thumbnails. */
export const projectImageSchema = z.object({
  src: z.string().startsWith('/'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  altRu: z.string().default(''),
  caption: z.string().default(''),
  captionRu: z.string().default(''),
  /** Where the image came from (README, live site, generated diagram); shown in the lightbox. */
  source: z.string().default(''),
})

export const projectLinkSchema = z.object({
  label: z.string(),
  labelRu: z.string().default(''),
  href: z.string().url(),
  kind: z.enum(['live', 'github', 'download', 'writeup']).default('live'),
})

/**
 * What the list, the detail hero, the gallery and the prev/next links need. It ships in the first
 * load, so it stays small: the long text, features and stack live in `projectDetailSchema`.
 */
export const projectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  year: z.number(),
  status: z.enum(['active', 'archived', 'personal']),
  /** Who it was built for: an employer (`work`), a freelance client (`freelance`, see `client`) or myself (`own`). */
  context: z.enum(['work', 'freelance', 'own']).default('own'),
  /** The client's name for freelance work, shown next to the label. */
  client: z.string().default(''),
  featured: z.boolean().default(false),
  titleRu: z.string().default(''),
  summary: z.string(),
  summaryRu: z.string().default(''),
  links: z.array(projectLinkSchema).default([]),
  /**
   * Gallery images; the first one is the list thumbnail and the lead image. Kept here (a few hundred
   * bytes each) so the whole gallery renders with the hero and nothing below it moves later.
   */
  images: z.array(projectImageSchema).default([]),
})

/** The per-project chunk a detail page loads on demand (packages/content/src/projects/details/<slug>.md). */
export const projectDetailSchema = z.object({
  /** Short feature bullets for the detail page; EN and RU lists line up item by item. */
  features: z.array(z.string()).default([]),
  featuresRu: z.array(z.string()).default([]),
  /** Full stack for the chips row; `tags` stay short because the list page filters on them. */
  stack: z.array(z.string()).default([]),
  body: z.string(),
  bodyRu: z.string().default(''),
})

export type Project = z.infer<typeof projectSchema>
export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type ProjectImage = z.infer<typeof projectImageSchema>
export type ProjectLink = z.infer<typeof projectLinkSchema>

export const socialsSchema = z.array(
  z.object({
    label: z.string(),
    href: z.string(),
    hint: z.string(),
  }),
)

export type Social = z.infer<typeof socialsSchema>[number]
