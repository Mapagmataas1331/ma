import { useTranslation } from 'react-i18next'

export function LanguageSwitch() {
  const { i18n: instance, t } = useTranslation('common')
  const current = instance.language.startsWith('ru') ? 'ru' : 'en'
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        className="h-10 rounded-sm border border-line bg-surface-1 px-2 text-sm text-fg"
        value={current}
        onChange={(e) => void instance.changeLanguage(e.target.value)}
      >
        <option value="en">{t('english')}</option>
        <option value="ru">{t('russian')}</option>
      </select>
    </label>
  )
}
