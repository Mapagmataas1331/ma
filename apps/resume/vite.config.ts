import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { appViteDefaults, gitLastModified, i18nPreloadPlugin, notFoundPlugin, ogImage, person, seoPagesPlugin } from '@ma/config/vite'
import { defineConfig } from 'vite'

// Facts for the JSON-LD come from the résumé itself, so they cannot drift from the page.
const resume = JSON.parse(readFileSync(new URL('../../packages/content/src/resume.en.json', import.meta.url), 'utf8')) as {
  experience: { org: string }[]
  education: { org: string }[]
  skills: Record<string, string[]>
}
const description = 'Résumé of Timofey (Mapagmataas): web systems, PostgreSQL and Redis, Linux infrastructure. About three years at the Budker Institute of Nuclear Physics.'

export default defineConfig({
  ...appViteDefaults(5174),
  plugins: [
    react(),
    tailwindcss(),
    i18nPreloadPlugin(),
    notFoundPlugin(),
    seoPagesPlugin('https://me.ma.cyou', [
      {
        path: '/',
        title: 'Timofey — Résumé: web systems, PostgreSQL, Linux · me.ma.cyou',
        description,
        ogTitle: 'Timofey — Résumé',
        ogDescription: 'CV without the corporate fog — web systems, PostgreSQL, Linux.',
        type: 'profile',
        image: ogImage('resume'),
        lastmod: gitLastModified(['packages/content/src/resume.en.json', 'packages/content/src/resume.ru.json', 'apps/resume/src']),
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            url: 'https://me.ma.cyou/',
            name: 'Timofey — Résumé',
            inLanguage: ['en', 'ru'],
            mainEntity: {
              ...person,
              worksFor: resume.experience.map((job) => ({ '@type': 'Organization', name: job.org })),
              alumniOf: resume.education.map((school) => ({ '@type': 'EducationalOrganization', name: school.org })),
              knowsAbout: [...new Set(Object.values(resume.skills).flat())],
            },
          },
        ],
      },
    ]),
  ],
})
