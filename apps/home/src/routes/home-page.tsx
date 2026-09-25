import { loadSocials } from '@ma/content'
import { Badge, Card, PageHeader } from '@ma/ui'
import { useTranslation } from 'react-i18next'

const links = [
  { href: import.meta.env.VITE_APP_ORIGIN_RESUME || 'https://me.ma.cyou', title: 'me.ma.cyou', key: 'resume' },
  { href: import.meta.env.VITE_APP_ORIGIN_PROJECTS || 'https://projects.ma.cyou', title: 'projects.ma.cyou', key: 'projects' },
  { href: import.meta.env.VITE_APP_ORIGIN_CHAT || 'https://chat.ma.cyou', title: 'chat.ma.cyou', key: 'chat' },
]

export function HomePage() {
  const { t } = useTranslation(['home', 'common'])
  const socials = loadSocials()
  return (
    <div>
      <PageHeader eyebrow="ma.cyou" title="Timofey" lead={t('lead')} />
      <p className="mb-8 max-w-2xl text-muted break-words">{t('intro')}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="block transition hover:-translate-y-0.5">
            <Card>
              <p className="text-xs text-muted">{t(link.key, { ns: 'common' })}</p>
              <p className="mt-2 text-lg font-medium">{link.title}</p>
            </Card>
          </a>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {socials.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
            <Badge>{s.label}</Badge>
          </a>
        ))}
      </div>
    </div>
  )
}
