// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadProjectDetail, loadProjects, loadResume, projectSlugs, type ProjectImage } from './index'

const publicDir = new URL('../../../apps/projects/public', import.meta.url)

/** Canvas size from a WebP header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(file: URL): [number, number] {
  const b = readFileSync(file)
  const chunk = b.toString('ascii', 12, 16)
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21)
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]
}

describe('project pages', () => {
  const projects = loadProjects()

  it('keeps the slug list in sync with the Markdown files', () => {
    expect([...projectSlugs].sort()).toEqual(projects.map((project) => project.slug).sort())
  })

  it('includes materials-tracker', () => {
    const tracker = projects.find((project) => project.slug === 'materials-tracker')
    expect(tracker?.links.some((link) => link.href === 'https://github.com/Mapagmataas1331/materials-tracker')).toBe(true)
  })

  it.each(projects.map((project) => [project.slug, project] as const))('%s has images and EN and RU content that lines up', async (slug, project) => {
    expect(project.summaryRu).not.toBe('')
    expect(project.images.length).toBeGreaterThan(0)
    const detail = await loadProjectDetail(slug)
    expect(detail).not.toBeNull()
    if (!detail) return
    expect(detail.features.length).toBeGreaterThan(2)
    expect(detail.featuresRu).toHaveLength(detail.features.length)
    expect(detail.body).not.toBe('')
    expect(detail.bodyRu).not.toBe('')
    expect(detail.stack.length).toBeGreaterThan(0)
    for (const image of project.images) {
      expect(image.altRu).not.toBe('')
      expect(image.captionRu).not.toBe('')
    }
  })

  it('has no detail chunk for an unknown slug', async () => {
    expect(await loadProjectDetail('nope')).toBeNull()
  })

  it('keeps the list metadata free of the long text', () => {
    for (const project of projects) {
      expect(Object.keys(project)).not.toContain('body')
      expect(Object.keys(project)).not.toContain('features')
    }
  })

  it('has every image on disk with the declared size', () => {
    const images: ProjectImage[] = projects.flatMap((project) => project.images)
    expect(images.length).toBeGreaterThan(projects.length)
    for (const image of images) {
      const src = image.src
      const file = new URL(`.${src}`, `${publicDir.href}/`)
      expect(existsSync(file), src).toBe(true)
      if (src.endsWith('.webp')) {
        expect(webpSize(file), src).toEqual([image.width, image.height])
        expect(existsSync(new URL(`.${src.replace(/\.webp$/, '-sm.webp')}`, `${publicDir.href}/`)), src).toBe(true)
      } else {
        expect(readFileSync(file, 'utf8'), src).toContain(`viewBox="0 0 ${image.width} ${image.height}"`)
      }
    }
  })

  it('lists materials-tracker on both résumés with existing screenshots', () => {
    for (const lang of ['en', 'ru'] as const) {
      const entry = loadResume(lang).projects.find((project) => project.slug === 'materials-tracker')
      expect(entry).toBeDefined()
      for (const shot of entry?.screenshots ?? []) {
        expect(existsSync(new URL(`../../../apps/resume/public${shot.src}`, import.meta.url))).toBe(true)
      }
    }
  })
})
