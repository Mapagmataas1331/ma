import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkyBackdrop } from './components/sky-backdrop'

describe('SkyBackdrop', () => {
  it('renders a decorative, non-interactive backdrop with a scene-coloured fallback', () => {
    const { container, unmount } = render(<SkyBackdrop parallax />)
    const root = container.querySelector('.ma-sky') as HTMLElement
    expect(root).toBeTruthy()
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.dataset.scene).toBe('day')
    expect(root.style.background).not.toBe('')
    expect(root.querySelectorAll('canvas')).toHaveLength(2)
    unmount()
  })

  it('follows the dark class on <html> for its first paint', () => {
    document.documentElement.classList.add('dark')
    try {
      const { container } = render(<SkyBackdrop />)
      expect((container.querySelector('.ma-sky') as HTMLElement).dataset.scene).toBe('night')
    } finally {
      document.documentElement.classList.remove('dark')
    }
  })

  it('renders a scene variant and marks <html data-sky> while mounted', () => {
    const { container, rerender, unmount } = render(<SkyBackdrop scene="resume" />)
    const root = container.querySelector('.ma-sky') as HTMLElement
    expect(root.dataset.variant).toBe('resume')
    expect(document.documentElement.dataset.sky).toBe('resume')
    const resumeSky = root.style.background
    rerender(<SkyBackdrop scene="conversation" />)
    expect(document.documentElement.dataset.sky).toBe('conversation')
    expect(root.style.background).not.toBe(resumeSky)
    unmount()
    expect(document.documentElement.dataset.sky).toBeUndefined()
  })
})
