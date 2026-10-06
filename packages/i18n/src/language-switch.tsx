import { useTranslation } from 'react-i18next'

export function LanguageSwitch() {
  const { i18n: instance, t } = useTranslation('common')
  const current = instance.language.startsWith('ru') ? 'ru' : 'en'
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        className="ma-focusable h-7 w-14 cursor-pointer rounded-sm border border-line bg-surface-1/90 pl-2 pr-1 text-xs text-fg transition hover:bg-surface-2"
        value={current}
        onChange={(e) => void instance.changeLanguage(e.target.value)}
      >
        <option value="en">EN</option>
        <option value="ru">RU</option>
      </select>
    </label>
  )
}
