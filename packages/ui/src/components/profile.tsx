import { authApi, type PublicProfile } from '@ma/api-client'
import { House, Link2, Orbit, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from './identicon'
import { cn } from '../lib/cn'
import { Dialog, Tooltip } from './primitives'

const icons = {
  introducer: Sparkles,
  connector: Link2,
  host: House,
  circle: Orbit,
} as const

const labels: Record<string, { name: string; hint: string }> = {
  introducer: { name: 'badgeIntroducer', hint: 'badgeIntroducerHint' },
  connector: { name: 'badgeConnector', hint: 'badgeConnectorHint' },
  host: { name: 'badgeHost', hint: 'badgeHostHint' },
  circle: { name: 'badgeCircle', hint: 'badgeCircleHint' },
}

export function BadgeRow({ badges }: { badges: string[] }) {
  const { t } = useTranslation('common')
  if (!badges.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((id) => {
        const Icon = icons[id as keyof typeof icons]
        if (!Icon) return null
        const copy = labels[id]
        return (
          <Tooltip key={id} label={copy ? `${t(copy.name)}. ${t(copy.hint)}` : id}>
            <button type="button" className="inline-flex size-7 items-center justify-center rounded-full bg-surface-2 text-accent" aria-label={copy ? t(copy.name) : id}>
              <Icon className="size-3.5" />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function ProfileButton({ username, displayName, className, actions = [], children }: { username: string; displayName?: string; className?: string; actions?: { id: string; label: string; onSelect: () => void }[]; children?: ReactNode }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<PublicProfile | null>(null)

  function show() {
    setOpen(true)
    void authApi.profile(username).then(setProfile).catch(() => setProfile(null))
  }

  const name = profile?.display_name || displayName || username
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''

  return (
    <>
      <button type="button" onClick={show} className={cn('inline-flex min-w-0 items-center gap-2 text-left', className)}>
        {children ?? <UserAvatar username={username} />}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={name} description={`@${username}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <UserAvatar username={username} className="size-24" />
          <BadgeRow badges={profile?.badges ?? []} />
          {joined ? <p className="text-sm text-muted">{t('joined')} {joined}</p> : null}
          {actions.length ? (
            <div className="flex w-full flex-col">
              {actions.map((action) => (
                <button key={action.id} type="button" className="rounded-sm px-2 py-3 text-sm hover:bg-surface-2" onClick={() => { setOpen(false); action.onSelect() }}>
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
