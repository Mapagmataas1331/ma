import i18n, { type BackendModule, type Resource, type ResourceKey } from 'i18next'
import { initReactI18next } from 'react-i18next'

export type Lang = 'en' | 'ru'
export type NamespaceBundle = Record<string, object>

const LANGS: Lang[] = ['en', 'ru']

// The shared `common` strings are the bulk of the i18n payload, so each language is its own chunk
// and only the active one is fetched. The build injects <meta name="ma-i18n"> with both chunk URLs
// (i18nPreloadPlugin in @ma/config/vite) and the inline pre-paint script in index.html preloads the
// active one, so this import usually resolves from cache instead of costing a round trip.
const commonLoaders: Record<Lang, () => Promise<{ default: ResourceKey }>> = {
  en: () => import('./locales/en/common.json'),
  ru: () => import('./locales/ru/common.json'),
}

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

/** i18next backend that lazy-loads `common` per language; app namespaces stay bundled. */
const lazyCommon: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = commonLoaders[language as Lang]
    if (namespace !== 'common' || !load) return callback(null, {})
    load().then(
      (mod) => callback(null, mod.default),
      (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), null),
    )
  },
}

export async function createI18n(extra: NamespaceBundle = {}) {
  const resources: Resource = { en: {}, ru: {} }
  for (const [ns, bundle] of Object.entries(extra)) {
    const typed = bundle as { en?: object; ru?: object }
    resources.en![ns] = typed.en ?? {}
    resources.ru![ns] = typed.ru ?? {}
  }
  if (!i18n.isInitialized) {
    await i18n.use(lazyCommon).use(initReactI18next).init({
      resources,
      // bundled app namespaces + lazily loaded `common`; changeLanguage() fetches the other language first
      partialBundledLanguages: true,
      lng: detectLanguage(),
      // en and ru carry the same keys (keys.test.ts), so a Russian visitor never needs the English chunk
      fallbackLng: false,
      supportedLngs: LANGS,
      load: 'currentOnly',
      ns: ['common', ...Object.keys(extra)],
      defaultNS: 'common',
      // ICU-style single-brace placeholders ("{count} online") without shipping an ICU parser:
      // the strings only use plain substitution, never plural/select/number formats
      interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
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
