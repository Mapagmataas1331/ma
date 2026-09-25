import i18n, { type Resource } from 'i18next'
import ICU from 'i18next-icu'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/common.json'
import ru from './locales/ru/common.json'

export type Lang = 'en' | 'ru'
export type NamespaceBundle = Record<string, object>

const LANGS: Lang[] = ['en', 'ru']

export function detectLanguage(): Lang {
  if (typeof window === 'undefined') return 'en'
  const query = new URLSearchParams(window.location.search).get('lang')
  if (query === 'en' || query === 'ru') return query
  const stored = window.localStorage.getItem('ma.lang')
  if (stored === 'en' || stored === 'ru') return stored
  return window.navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function apply(lng: string) {
  if (typeof document === 'undefined') return
  const lang = lng.startsWith('ru') ? 'ru' : 'en'
  document.documentElement.lang = lang
  window.localStorage.setItem('ma.lang', lang)
}

export async function createI18n(extra: NamespaceBundle = {}) {
  const resources: Resource = { en: { common: en }, ru: { common: ru } }
  for (const [ns, bundle] of Object.entries(extra)) {
    const typed = bundle as { en?: object; ru?: object }
    resources.en![ns] = typed.en ?? {}
    resources.ru![ns] = typed.ru ?? {}
  }
  if (!i18n.isInitialized) {
    await i18n.use(ICU).use(initReactI18next).init({
      resources,
      lng: detectLanguage(),
      fallbackLng: 'en',
      supportedLngs: LANGS,
      ns: Object.keys(resources.en ?? { common: {} }),
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    apply(i18n.language)
    i18n.on('languageChanged', apply)
  } else {
    for (const lng of LANGS) {
      for (const [ns, value] of Object.entries(resources[lng] ?? {})) {
        i18n.addResourceBundle(lng, ns, value, true, true)
      }
    }
  }
  return i18n
}

export { LanguageSwitch } from './language-switch'
export { i18n }
