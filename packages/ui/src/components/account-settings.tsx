import { ApiError, authApi, type BadgeTrack } from '@ma/api-client'
import { canonicalDisplayName, canonicalUsername, displayNameError, passwordError, usernameError } from '@ma/protocol'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from './identicon'
import { BadgeRow, ProfileButton } from './profile'
import { Button, Input, Label, SettingsRow, SettingsSection } from './primitives'

type Account = {
  username: string
  display_name: string
  invite_credits: number
  invited: number
  badges: string[]
  badge_tracks?: BadgeTrack[]
  username_next_at?: string | null
  invitees: { username: string; display_name: string }[]
  open_invites?: { id: string; expires_at: string; created_at: string }[]
}

export const AppSettingsSlot = createContext<{ slot: HTMLElement | null; setSlot: (node: HTMLElement | null) => void }>({
  slot: null,
  setSlot: () => {},
})

export function AppSettings({ children }: { children: ReactNode }) {
  const { slot } = useContext(AppSettingsSlot)
  if (!slot) return null
  return createPortal(children, slot)
}

export function AccountSettings() {
  const { t } = useTranslation('common')
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [display, setDisplay] = useState('')
  const [invite, setInvite] = useState('')
  const [code, setCode] = useState('')
  const { setSlot } = useContext(AppSettingsSlot)
  const [error, setError] = useState('')
  const [editDisplay, setEditDisplay] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileSaved, setProfileSaved] = useState('')

  async function load() {
    setError('')
    try {
      const session = await authApi.session()
      if (!session.authenticated) {
        setAccount(null)
        return
      }
      const next = await authApi.account()
      setAccount(next)
      setEditDisplay(next.display_name)
      setEditUsername(next.username)
    } catch (err) {
      setAccount(null)
      if (err instanceof ApiError && err.code !== 'unauthorized' && err.status !== 401) {
        setError(err.message || t('somethingWentWrong'))
      }
    } finally {
      setReady(true)
    }
  }

  useEffect(() => {
    void load()
    const onAuth = () => void load()
    window.addEventListener('ma-auth', onAuth)
    return () => window.removeEventListener('ma-auth', onAuth)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const nameError = usernameError(username)
    const passError = passwordError(password)
    const shown = mode === 'up' ? displayNameError(display || username) : ''
    if (nameError || passError || shown) {
      setError(nameError || shown || passError)
      return
    }
    try {
      if (mode === 'up') {
        await authApi.register({ invite_code: invite, username, password, display_name: canonicalDisplayName(display || username) })
        setMode('in')
        setInvite('')
        return
      }
      const res = await authApi.loginAccount({ username, password })
      if (res.status === '2fa_required') {
        setError(t('signInInChatFor2fa'))
        return
      }
      window.dispatchEvent(new Event('ma-auth'))
      await load()
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'server_overloaded' ? t('registerOverloaded') : err instanceof Error ? err.message : t('somethingWentWrong'))
    }
  }

  async function createInvite() {
    try {
      const created = await authApi.createInvite()
      setCode(created.code)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'))
    }
  }

  async function revokeInvite(id: string) {
    try {
      await authApi.revokeInvite(id)
      if (code) setCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'))
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!account) return
    setProfileSaved('')
    setError('')
    const shown = displayNameError(editDisplay)
    if (shown) {
      setError(t('displayNameInvalid'))
      return
    }
    const nameChanged = canonicalUsername(editUsername) !== account.username
    if (nameChanged) {
      const nameError = usernameError(editUsername)
      if (nameError) {
        setError(t('usernameInvalid'))
        return
      }
      if (account.username_next_at) {
        setError(t('usernameCooldown', { date: new Date(account.username_next_at).toLocaleDateString() }))
        return
      }
    }
    setProfileBusy(true)
    try {
      const body: { display_name: string; username?: string } = { display_name: canonicalDisplayName(editDisplay) }
      if (nameChanged) body.username = canonicalUsername(editUsername)
      const updated = await authApi.patchMe(body)
      setAccount((cur) => (cur ? { ...cur, username: updated.username, display_name: updated.display_name } : cur))
      setEditUsername(updated.username)
      setEditDisplay(updated.display_name)
      setProfileSaved(t('profileSaved'))
      window.dispatchEvent(new Event('ma-auth'))
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'username_cooldown') {
        const next = (err.details as { next_at?: string } | undefined)?.next_at
        setError(t('usernameCooldown', { date: next ? new Date(next).toLocaleDateString() : '—' }))
      } else if (err instanceof ApiError && err.code === 'username_taken') {
        setError(t('usernameTaken'))
      } else {
        setError(err instanceof Error ? err.message : t('somethingWentWrong'))
      }
    } finally {
      setProfileBusy(false)
    }
  }

  if (!ready) return null

  if (!account) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <SettingsSection title={t('account')} description={t('signInToSee')}>
          <form className="space-y-3 px-4 py-3" onSubmit={onSubmit}>
            {mode === 'up' ? <Input placeholder={t('inviteCode')} aria-label={t('inviteCode')} value={invite} onChange={(e) => setInvite(e.target.value)} required /> : null}
            <Input placeholder={t('username')} aria-label={t('username')} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            {mode === 'up' ? <Input placeholder={t('displayName')} aria-label={t('displayName')} value={display} onChange={(e) => setDisplay(e.target.value)} /> : null}
            <Input type="password" placeholder={t('accountPassword')} aria-label={t('accountPassword')} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit">{mode === 'up' ? t('register') : t('signIn')}</Button>
            {mode === 'in' ? (
              <button type="button" className="block text-sm text-accent/80 underline decoration-accent/25 underline-offset-2 hover:text-accent hover:decoration-accent/50" onClick={() => setMode('up')}>
                {t('haveInvite')}
              </button>
            ) : null}
          </form>
        </SettingsSection>
        <div ref={setSlot} />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SettingsSection title={t('account')} description={account.display_name}>
        <div className="flex items-center gap-3 px-4 py-3">
          <ProfileButton username={account.username} displayName={account.display_name}>
            <UserAvatar username={account.username} className="size-14" />
          </ProfileButton>
          <div>
            <p className="font-medium">{account.display_name}</p>
            <p className="text-sm text-muted">@{account.username}</p>
            <div className="mt-2">
              <BadgeRow tracks={account.badge_tracks} badges={account.badges} />
            </div>
          </div>
        </div>
        <form className="space-y-3 border-t border-line px-4 py-3" onSubmit={(e) => void saveProfile(e)}>
          <p className="text-sm font-medium">{t('editProfile')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name" className="text-xs text-muted">{t('displayName')}</Label>
            <Input id="edit-display-name" placeholder={t('displayName')} aria-label={t('displayName')} value={editDisplay} onChange={(e) => setEditDisplay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-username" className="text-xs text-muted">{t('username')}</Label>
            <Input id="edit-username" placeholder={t('username')} aria-label={t('username')} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={!!account.username_next_at} />
          </div>
          <p className="text-xs text-muted">
            {account.username_next_at
              ? t('usernameCooldown', { date: new Date(account.username_next_at).toLocaleDateString() })
              : t('usernameChangeHint')}
          </p>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          {profileSaved ? <p className="text-sm text-accent">{profileSaved}</p> : null}
          <Button type="submit" disabled={profileBusy}>{t('saveProfile')}</Button>
        </form>
        <SettingsRow label={t('invitesLeft')}>
          <span className="text-sm">{account.invite_credits}</span>
        </SettingsRow>
        <SettingsRow label={t('createInvite')}>
          <Button variant="outline" onClick={() => void createInvite()} disabled={account.invite_credits < 1}>
            {t('createInvite')}
          </Button>
        </SettingsRow>
        {code ? <p className="px-4 py-2 font-mono text-sm">{code}<span className="mt-1 block font-sans text-xs text-muted">{t('inviteOnce')}</span></p> : null}
        <SettingsRow label={t('openInvites')}>
          {account.open_invites?.length ? (
            <span className="text-xs text-muted">{account.open_invites.length}</span>
          ) : (
            <span className="text-sm text-muted">{t('noOpenInvites')}</span>
          )}
        </SettingsRow>
        {account.open_invites?.length ? (
          <ul className="space-y-2 border-t border-line px-4 py-3">
            {account.open_invites.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-xs text-muted">{new Date(item.expires_at).toLocaleDateString()}</span>
                <Button variant="ghost" onClick={() => void revokeInvite(item.id)}>{t('revokeInvite')}</Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2 border-t border-line px-4 py-3">
          <p className="text-sm font-medium">{t('peopleInvited')}</p>
          {account.invitees.length ? (
            <ul className="flex flex-col gap-2">
              {account.invitees.map((p) => (
                <li key={p.username}>
                  <ProfileButton username={p.username} displayName={p.display_name}>
                    <span className="inline-flex items-center gap-2 text-sm">
                      <UserAvatar username={p.username} className="size-6" />
                      {p.display_name || p.username}
                    </span>
                  </ProfileButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t('noInvitesYet')}</p>
          )}
        </div>
        <SettingsRow label={t('signOut')}>
          <Button
            variant="ghost"
            onClick={() => {
              void authApi.logout().then(() => {
                setCode('')
                window.dispatchEvent(new Event('ma-auth'))
              })
            }}
          >
            {t('signOut')}
          </Button>
        </SettingsRow>
      </SettingsSection>
      <div ref={setSlot} />
      <p className="px-1 pb-8 text-sm leading-relaxed text-muted">
        {t('feedbackBefore')}
        <button
          type="button"
          className="cursor-pointer text-fg underline decoration-line underline-offset-2"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const here = location.port === '5176' || location.hostname.startsWith('chat.')
            if (!here) {
              location.assign(location.port ? `${location.protocol}//${location.hostname}:5176/` : 'https://chat.ma.cyou/')
              return
            }
            window.dispatchEvent(new CustomEvent('ma-write', { detail: 'ma' }))
          }}
        >
          @ma
        </button>
        {t('feedbackAfter')}
      </p>
    </div>
  )
}
