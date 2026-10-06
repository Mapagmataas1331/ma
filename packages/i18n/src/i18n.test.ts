import { describe, expect, it } from 'vitest'
import { createI18n } from './index'

describe('createI18n', () => {
  it('loads only the active language and fills single-brace placeholders', async () => {
    window.localStorage.setItem('ma.lang', 'en')
    const i18n = await createI18n({ demo: { en: { hi: 'Hi {name}' }, ru: { hi: 'Привет, {name}' } } })
    expect(i18n.t('typing', { name: 'Ann' })).toBe('Ann is typing…')
    expect(i18n.t('seenBy', { count: 2, total: 3 })).toBe('seen by 2 of 3')
    expect(i18n.t('demo:hi', { name: 'Bo' })).toBe('Hi Bo')
    expect(i18n.hasResourceBundle('ru', 'common')).toBe(false)

    await i18n.changeLanguage('ru')
    expect(i18n.t('seenBy', { count: 2, total: 3 })).toBe('просмотрено 2 из 3')
    expect(i18n.t('demo:hi', { name: 'Bo' })).toBe('Привет, Bo')
    expect(document.documentElement.lang).toBe('ru')
    expect(window.localStorage.getItem('ma.lang')).toBe('ru')
  })
})
