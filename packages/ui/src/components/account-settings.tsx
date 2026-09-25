import { authApi } from '@ma/api-client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from './identicon'
import { BadgeRow, ProfileButton } from './profile'
import { Button, Input, SettingsRow, SettingsSection } from './primitives'

type Account = {
  username: string
  display_name: string
  invite_credits: number
  invited: number
  badges: string[]
  invitees: { username: string; display_name: string }[]
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

  async function load() {
    try {
      setAccount(await authApi.account())
    } catch {
      setAccount(null)
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
    try {
      if (mode === 'up') {
        await authApi.register({ invite_code: invite, username, password, display_name: display || username })
        setMode('in')
        setInvite('')
        return
      }
      const res = await authApi.loginAccount({ username, password })
      if (res.status === '2fa_required') {
        setError('2fa')
        return
      }
      window.dispatchEvent(new Event('ma-auth'))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error')
    }
  }

  async function createInvite() {
    const created = await authApi.createInvite()
    setCode(created.code)
    await load()
  }

  if (!ready) return null

  if (!account) {
    return (
      <SettingsSection title={t('account')} description={t('signInToSee')}>
        <form className="space-y-3 px-4 py-3" onSubmit={onSubmit}>
          {mode === 'up' ? <Input placeholder={t('inviteCode')} value={invite} onChange={(e) => setInvite(e.target.value)} required /> : null}
          <Input placeholder={t('username')} value={username} onChange={(e) => setUsername(e.target.value)} required />
          {mode === 'up' ? <Input placeholder={t('displayName')} value={display} onChange={(e) => setDisplay(e.target.value)} /> : null}
          <Input type="password" placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit">{mode === 'up' ? t('register') : t('signIn')}</Button>
          {mode === 'in' ? (
            <button type="button" className="block text-sm text-muted" onClick={() => setMode('up')}>
              {t('haveInvite')}
            </button>
          ) : null}
        </form>
      </SettingsSection>
    )
  }

  return (
    <>
      <SettingsSection title={t('account')} description={account.display_name}>
        <div className="flex items-center gap-3 px-4 py-3">
          <ProfileButton username={account.username} displayName={account.display_name}>
            <UserAvatar username={account.username} className="size-14" />
          </ProfileButton>
          <div>
            <p className="font-medium">{account.display_name}</p>
            <p className="text-sm text-muted">@{account.username}</p>
            <div className="mt-2">
              <BadgeRow badges={account.badges} />
            </div>
          </div>
        </div>
        <SettingsRow label={t('invitesLeft')}>
          <span className="text-sm">{account.invite_credits}</span>
        </SettingsRow>
        <SettingsRow label={t('createInvite')}>
          <Button variant="outline" onClick={() => void createInvite()} disabled={account.invite_credits < 1}>
            {t('createInvite')}
          </Button>
        </SettingsRow>
        {code ? <p className="px-4 py-2 font-mono text-sm">{code}<span className="mt-1 block font-sans text-xs text-muted">{t('inviteOnce')}</span></p> : null}
        <SettingsRow label={t('peopleInvited')}>
          <span className="flex flex-col items-end gap-1 text-sm">
            {account.invitees.length
              ? account.invitees.map((p) => (
                  <ProfileButton key={p.username} username={p.username} displayName={p.display_name}>
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar username={p.username} className="size-6" />
                      {p.display_name || p.username}
                    </span>
                  </ProfileButton>
                ))
              : t('noInvitesYet')}
          </span>
        </SettingsRow>
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
    </>
  )
}
