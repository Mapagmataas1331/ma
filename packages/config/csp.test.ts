// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { addConnectSrc } from './vite'

const prod = readFileSync(new URL('../../apps/chat/public/_headers', import.meta.url), 'utf8')

describe('chat _headers', () => {
  it('production CSP does not allow localhost', () => {
    expect(prod).toMatch(/connect-src 'self' https:\/\/api\.ma\.cyou wss:\/\/api\.ma\.cyou;/)
    expect(prod).not.toMatch(/localhost|127\.0\.0\.1/)
    expect(prod).toMatch(/X-Robots-Tag: noindex/)
  })

  it('adds a local API origin and its ws twin to connect-src', () => {
    const out = addConnectSrc(prod, 'http://localhost:8080')
    expect(out).toContain(
      "connect-src 'self' https://api.ma.cyou wss://api.ma.cyou http://localhost:8080 ws://localhost:8080;",
    )
    expect(out.split('\n').filter((line) => line.includes('localhost'))).toHaveLength(1)
    expect(out.replace(/connect-src[^;]*;/, '')).toBe(prod.replace(/connect-src[^;]*;/, ''))
  })

  it('uses wss for https origins and does not duplicate sources', () => {
    const out = addConnectSrc(prod, 'https://api.ma.cyou/')
    expect(out).toBe(prod)
    expect(addConnectSrc(prod, 'https://staging.example')).toContain(
      'https://staging.example wss://staging.example;',
    )
  })
})
