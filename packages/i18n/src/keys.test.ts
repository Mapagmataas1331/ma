import { describe, expect, it } from 'vitest'
import en from './locales/en/common.json'
import ru from './locales/ru/common.json'

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

describe('common locale parity', () => {
  it('has the same keys in English and Russian', () => {
    expect(keys(ru).sort()).toEqual(keys(en).sort())
  })

  it('asks the new device with the agreed transfer prompt', () => {
    expect(en.transferAsk).toBe('Do you want to transfer your chats from another device?')
  })

  it('uses the same single-brace placeholders in both languages', () => {
    const flat = (value: Record<string, unknown>) => Object.entries(value).filter(([, v]) => typeof v === 'string') as [string, string][]
    const ruMap = new Map(flat(ru))
    for (const [key, text] of flat(en)) {
      // i18next is configured with prefix "{" / suffix "}": a "{{x}}" would render as "{x}"
      expect(text, key).not.toMatch(/\{\{|\}\}/)
      const names = (s: string) => [...s.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort()
      expect(names(ruMap.get(key) ?? ''), key).toEqual(names(text))
    }
  })
})
