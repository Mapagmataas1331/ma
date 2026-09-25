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
})
