import { describe, expect, it } from 'vitest'
import { loadProjects, loadResume, loadSocials } from './index'

describe('content', () => {
  it('parses both résumés and projects', () => {
    expect(loadResume('en').profile.name.length).toBeGreaterThan(0)
    expect(loadResume('ru').experience.length).toBeGreaterThan(0)
    expect(loadProjects().length).toBeGreaterThan(3)
    const pocket = loadProjects().find((project) => project.slug === 'pocketcam')
    expect(pocket?.links[0]).toEqual({ label: 'GitHub', href: 'https://github.com/Mapagmataas1331/PocketCam' })
    expect(loadSocials()[0]?.href.startsWith('http') || loadSocials()[0]?.href.startsWith('mailto')).toBe(true)
  })
})
