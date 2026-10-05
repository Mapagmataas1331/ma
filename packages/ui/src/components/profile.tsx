import { authApi, type BadgeTrack, type PublicProfile } from '@ma/api-client'
import {
  CalendarDays,
  Crown,
  House,
  Link2,
  MonitorSmartphone,
  Orbit,
  Smartphone,
  Sparkles,
  Tablets,
  TreeDeciduous,
  Trees,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from './identicon'
import { cn } from '../lib/cn'
import { Dialog, Tooltip } from './primitives'

type TrackVisual = {
  icons: Record<string, typeof Sparkles>
  tones: Record<string, string>
  noneKey: string
  progressKey: string
  maxKey: string
}

const tracks: Record<string, TrackVisual> = {
  invites: {
    icons: { '': Sparkles, introducer: Sparkles, connector: Link2, host: House, circle: Orbit },
    tones: {
      '': 'bg-surface-2 text-muted',
      introducer: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      connector: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      host: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      circle: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
    },
    noneKey: 'badgeInvitesNone',
    progressKey: 'badgeInvitesProgress',
    maxKey: 'badgeInvitesMax',
  },
  tenure: {
    icons: { '': CalendarDays, settling: UserRound, regular: Trees, veteran: TreeDeciduous, elder: Crown },
    tones: {
      '': 'bg-surface-2 text-muted',
      settling: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
      regular: 'bg-teal-500/15 text-teal-600 dark:text-teal-300',
      veteran: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
      elder: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    },
    noneKey: 'badgeTenureNone',
    progressKey: 'badgeTenureProgress',
    maxKey: 'badgeTenureMax',
  },
  contacts: {
    icons: { '': UserRound, penpal: UserRound, ally: Users, crew: UsersRound, clan: Orbit },
    tones: {
      '': 'bg-surface-2 text-muted',
      penpal: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
      ally: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
      crew: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
      clan: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
    },
    noneKey: 'badgeContactsNone',
    progressKey: 'badgeContactsProgress',
    maxKey: 'badgeContactsMax',
  },
  devices: {
    icons: { '': Smartphone, paired: Smartphone, synced: MonitorSmartphone, fleet: Tablets },
    tones: {
      '': 'bg-surface-2 text-muted',
      paired: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
      synced: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
      fleet: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
    },
    noneKey: 'badgeDevicesNone',
    progressKey: 'badgeDevicesProgress',
    maxKey: 'badgeDevicesMax',
  },
  groups: {
    icons: { '': Users, member: Users, regulars: UsersRound, organizer: House },
    tones: {
      '': 'bg-surface-2 text-muted',
      member: 'bg-stone-500/15 text-stone-600 dark:text-stone-300',
      regulars: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
      organizer: 'bg-red-500/15 text-red-600 dark:text-red-300',
    },
    noneKey: 'badgeGroupsNone',
    progressKey: 'badgeGroupsProgress',
    maxKey: 'badgeGroupsMax',
  },
}

function trackMeta(track: BadgeTrack, t: (key: string, opts?: Record<string, unknown>) => string) {
  const visual = tracks[track.id]
  if (!visual) {
    return { Icon: Sparkles, tone: 'bg-surface-2 text-muted', label: track.id, name: track.id }
  }
  const tier = track.tier || ''
  const name = track.tier ? t(`badge_${track.tier}`) : t(visual.noneKey)
  const progress = track.next != null
    ? t(visual.progressKey, { count: track.value, next: track.next })
    : t(visual.maxKey, { count: track.value })
  return {
    Icon: visual.icons[tier] ?? Sparkles,
    tone: visual.tones[tier] ?? visual.tones[''],
    label: `${name}. ${progress}`,
    name,
  }
}

/** One chip per progressive track. Icon and color follow the current tier. */
export function BadgeRow({ tracks: trackList, badges }: { tracks?: BadgeTrack[]; badges?: string[] }) {
  const { t } = useTranslation('common')
  const list = trackList?.length
    ? trackList
    : (badges ?? []).map((tier) => ({ id: 'invites', tier, value: 0, next: null as number | null }))
  if (!list.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((track) => {
        const meta = trackMeta(track, t)
        const Icon = meta.Icon
        return (
          <Tooltip key={track.id} label={meta.label}>
            <button type="button" className={cn('inline-flex size-7 items-center justify-center rounded-full', meta.tone)} aria-label={meta.label}>
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
  const [loadError, setLoadError] = useState(false)

  function show() {
    setOpen(true)
    setLoadError(false)
    void authApi.profile(username).then((row) => {
      setProfile(row)
      setLoadError(false)
    }).catch(() => {
      setProfile(null)
      setLoadError(true)
    })
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
          <BadgeRow tracks={profile?.badge_tracks} badges={profile?.badges} />
          {joined ? <p className="text-sm text-muted">{t('joined')} {joined}</p> : null}
          {loadError ? <p className="text-sm text-danger">{t('profileLoadFailed')}</p> : null}
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
