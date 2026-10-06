// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Every inline <script> (except JSON data blocks) in an app's index.html must be allowed by a
// 'sha256-…' source in that app's public/_headers CSP, or browsers silently refuse to run it.
const apps = ['home', 'projects', 'resume', 'chat']

describe('inline script CSP hashes', () => {
  for (const app of apps) {
    it(`${app}: _headers pins every inline script`, () => {
      const html = readFileSync(new URL(`../../apps/${app}/index.html`, import.meta.url), 'utf8')
      const headers = readFileSync(new URL(`../../apps/${app}/public/_headers`, import.meta.url), 'utf8')
      const csp = headers.split(/\r?\n/).find((line) => /content-security-policy/i.test(line)) ?? ''
      const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(
        ([, attrs = '']) => !/\bsrc=/.test(attrs) && !/type="application\/(ld\+)?json"/.test(attrs),
      )
      expect(scripts.length).toBeGreaterThan(0)
      for (const [, , body = ''] of scripts) {
        const hash = createHash('sha256').update(body, 'utf8').digest('base64')
        expect(csp).toContain(`'sha256-${hash}'`)
      }
    })
  }
})
