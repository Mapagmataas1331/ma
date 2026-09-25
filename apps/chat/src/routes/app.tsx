import { api, authApi } from '@ma/api-client'
import { b64, boxKeyPair, pairingConfirm, randomFileKey, ready, secretstreamHeader, secretstreamPush, signKeyPair } from '@ma/crypto'
import { MAILBOX_MAX_FILE_BYTES, newFrame } from '@ma/protocol'
import {
  AppSettings,
  Button,
  ProfileButton,
  UserAvatar,
  DayDivider,
  Input,
  MessageBubble,
  PresenceDot,
  TypingIndicator,
  PageHeader,
  SettingsRow,
  SettingsSection,
  Switch,
  Textarea,
  TransferProgress,
  toast,
} from '@ma/ui'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession, loadDevicePublicKeys, saveDevicePublicKeys } from '../lib/session'
import { transport } from '../lib/transport'
import { addRecoverySlot, changeVaultPassword, createVault, hasVault, isUnlocked, loadHistory, lockVault, sealRow, unlockVault } from '../lib/vault'

type Me = { id: string; username: string; display_name: string; totp_enabled?: boolean }
type Contact = { id: string; username: string; display_name: string; state: string }
type Conversation = { id: string; peer_id: string; peer_name: string; peer_username?: string }
type LocalMessage = { id: string; conversationId: string; body: string; mine: boolean; at: string; status: string }

function deviceKeys() {
  const existing = loadDevicePublicKeys()
  if (existing) return existing
  return null
}

export function ChatApp() {
  const { t } = useTranslation('common')
  const session = useSession()
  const [mode, setMode] = useState<'login' | 'register' | '2fa' | 'app'>('login')
  const [challenge, setChallenge] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [display, setDisplay] = useState('')
  const [invite, setInvite] = useState('')
  const [code, setCode] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [lookup, setLookup] = useState('')
  const [enterToSend, setEnterToSend] = useState(true)
  const [relay, setRelay] = useState(false)
  const [showNames, setShowNames] = useState(false)
  const [transfer, setTransfer] = useState<{ name: string; value: number } | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [pairQr, setPairQr] = useState('')
  const [pendingSync, setPendingSync] = useState(false)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [typing, setTyping] = useState<{ conversationId: string; name: string } | null>(null)
  const typedAt = useRef(0)
  const [hourCycle, setHourCycle] = useState<'24' | '12'>(() => (localStorage.getItem('ma.time') === '12' ? '12' : '24'))

  useEffect(() => {
    if (!unlocked) {
      setMessages([])
      return
    }
    void loadHistory().then(setMessages)
  }, [unlocked])

  useEffect(() => {
    const refreshSession = () => {
      void authApi.me().then((me) => {
        session.setSession(me, session.deviceId, session.trust)
        setMode('app')
      }).catch(() => setMode('login'))
    }
    refreshSession()
    window.addEventListener('ma-auth', refreshSession)
    return () => window.removeEventListener('ma-auth', refreshSession)
  }, [])

  useEffect(() => {
    if (mode !== 'app' || !unlocked) return
    transport.relayOnly = relay
    transport.connect()
    const off = transport.on((frame) => {
      if (frame.t === 'mailbox.new') void drainMailbox()
      if (frame.t === 'presence.snapshot') {
        const users = Array.isArray(frame.p.users) ? frame.p.users.map(String) : []
        setOnline(new Set(users))
      }
      if (frame.t === 'presence.update') {
        const id = String(frame.p.user ?? '')
        setOnline((prev) => {
          const next = new Set(prev)
          if (frame.p.online) next.add(id)
          else next.delete(id)
          return next
        })
      }
      if (frame.t === 'chat.typing') {
        const conversationId = String(frame.p.conversation_id ?? '')
        const name = String(frame.p.name ?? '')
        setTyping({ conversationId, name })
        window.setTimeout(() => setTyping((cur) => (cur?.conversationId === conversationId ? null : cur)), 2500)
      }
    })
    void refresh()
    return () => {
      off()
    }
  }, [mode, unlocked, relay])

  async function refresh() {
    const [c, conv] = await Promise.all([
      api<Contact[]>('/v1/contacts'),
      api<Conversation[]>('/v1/conversations'),
    ])
    setContacts(c)
    setConversations(conv)
    const devices = await api<{ id: string; trust_state: string; current?: boolean }[]>('/v1/devices')
    setPendingSync(devices.some((d) => d.trust_state === 'trusted' && !d.current))
  }

  async function ensureDevice() {
    await ready()
    let keys = deviceKeys()
    if (!keys) {
      const sign = signKeyPair()
      const box = boxKeyPair()
      keys = { ed25519: b64(sign.publicKey), x25519: b64(box.publicKey) }
      saveDevicePublicKeys(keys)
    }
    return keys
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    const keys = await ensureDevice()
    const res = await authApi.login({
      username,
      password,
      device: { name: navigator.userAgent.slice(0, 64), platform: navigator.platform, pk_ed25519: keys.ed25519, pk_x25519: keys.x25519 },
    })
    if (res.status === '2fa_required' && res.challenge_id) {
      setChallenge(res.challenge_id)
      setMode('2fa')
      return
    }
    if (res.user) session.setSession(res.user, res.device?.id ?? null, res.device?.trust_state ?? null)
    setMode('app')
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    try {
      await authApi.register({ invite_code: invite, username, password, display_name: display || username })
      toast(t('accountCreated'))
      setMode('login')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('couldNotRegister'))
    }
  }

  async function on2fa(e: React.FormEvent) {
    e.preventDefault()
    const res = await authApi.login2fa({ challenge_id: challenge, code }) as { user: Me; device: { id: string; trust_state: string } }
    session.setSession(res.user, res.device.id, res.device.trust_state)
    setMode('app')
  }

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!(await hasVault())) {
      const pubs = await createVault(vaultPassword)
      await api('/v1/users/me/identity-keys', { method: 'PUT', body: JSON.stringify({ ed25519: pubs.ed25519, x25519: pubs.x25519 }) })
    } else {
      await unlockVault(vaultPassword)
    }
    setUnlocked(true)
    setVaultPassword('')
  }

  async function drainMailbox() {
    const items = await api<{ id: string; envelope: string }[]>('/v1/mailbox/messages')
    for (const item of items) {
      const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(item.envelope), (c) => c.charCodeAt(0))))
      const decoded = transport.decryptEnvelope(raw)
      let body = decoded
      let conversationId = ''
      let at = new Date().toISOString()
      try {
        const parsed = JSON.parse(decoded) as { body?: string; conversation_id?: string; sent_at?: string }
        if (parsed.body) body = parsed.body
        if (parsed.conversation_id) conversationId = parsed.conversation_id
        if (parsed.sent_at) at = parsed.sent_at
      } catch {
        conversationId = ''
      }
      const message = { id: item.id, conversationId, body, mine: false, at, status: 'delivered' }
      setMessages((prev) => (prev.some((m) => m.id === item.id) ? prev : [...prev, message]))
      await sealRow('records', item.id, 'messages', message)
      await api(`/v1/mailbox/messages/${item.id}/ack`, { method: 'POST' })
    }
  }

  function notifyTyping(peerId: string, conversationId: string) {
    const now = Date.now()
    if (now - typedAt.current < 1500) return
    typedAt.current = now
    transport.sendFrame(newFrame('chat.typing', { conversation_id: conversationId, name: session.user?.display_name || session.user?.username || '' }, { user: peerId }))
  }

  async function send() {
    const conv = conversations.find((c) => c.id === active)
    const text = draft.trim()
    if (!conv || !text) return
    const id = crypto.randomUUID()
    const at = new Date().toISOString()
    const message = { id, conversationId: conv.id, body: text, mine: true, at, status: 'sent' }
    setMessages((prev) => [...prev, message])
    setDraft('')
    await sealRow('records', id, 'messages', message)
    const payload = JSON.stringify({ conversation_id: conv.id, body: text, sent_at: at })
    try {
      const keys = await api<{ x25519: string }>(`/v1/contacts/${conv.peer_id}/keys`)
      await transport.deliverText({ id, conversationId: conv.id, recipientUserId: conv.peer_id, state: 'queued', envelope: payload, size: text.length, attempts: 0 }, keys.x25519)
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)))
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    await api('/v1/contacts', { method: 'POST', body: JSON.stringify({ username: lookup }) })
    setLookup('')
    await refresh()
  }

  async function openDirect(userId: string, name: string) {
    const conv = await api<Conversation>('/v1/conversations', { method: 'POST', body: JSON.stringify({ kind: 'direct', user_id: userId }) })
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [...prev, { ...conv, peer_name: name }]))
    setActive(conv.id)
  }

  async function onFile(file: File) {
    const conv = conversations.find((c) => c.id === active)
    if (!conv) return
    const key = randomFileKey()
    const header = secretstreamHeader(key)
    const buf = new Uint8Array(await file.arrayBuffer())
    secretstreamPush(header.state, buf, true)
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('pending_outbox', { create: true })
    const handle = await dir.getFileHandle(file.name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(file)
    await writable.close()
    if (file.size > MAILBOX_MAX_FILE_BYTES) {
      toast(t('offlineFile', { name: conv.peer_name }))
      setTransfer({ name: file.name, value: 0 })
      return
    }
    const form = new FormData()
    form.set('file', file)
    form.set('conversation_id', conv.id)
    form.set('recipient_user_id', conv.peer_id)
    form.set('file_id', crypto.randomUUID())
    form.set('envelope', b64(key))
    setTransfer({ name: file.name, value: 30 })
    try {
      await api('/v1/mailbox/files', { method: 'POST', body: form })
      setTransfer({ name: file.name, value: 100 })
    } catch {
      toast(t('offlineFile', { name: conv.peer_name }))
    }
  }

  async function startPair() {
    const res = await api<{ pairing_id: string; code: string }>('/v1/devices/pairing', { method: 'POST' })
    setPairCode(res.code)
    const keys = loadDevicePublicKeys()
    setPairQr(await QRCode.toDataURL(JSON.stringify({ pairing_id: res.pairing_id, pk: keys?.x25519, code: res.code })))
  }

  async function claimPair(pairingId: string, codeValue: string, pkB: string) {
    await api(`/v1/devices/pairing/${pairingId}/claim`, { method: 'POST' })
    const local = loadDevicePublicKeys()
    if (!local) return
    const tag = pairingConfirm(codeValue, unhex(local.x25519), unhex(pkB), pairingId)
    transport.sendFrame(newFrame('pair.confirm', { tag, pairing_id: pairingId }))
  }

  const thread = useMemo(() => messages.filter((m) => m.conversationId === active), [messages, active])
  const activeConv = conversations.find((c) => c.id === active)

  const chatSettings = session.user ? (
    <AppSettings>
      <SettingsSection title={t('chat')}>
        <SettingsRow label={t('showSenderNames')} hint={t('showSenderNamesHint')}>
          <Switch checked={showNames} onCheckedChange={setShowNames} label={t('showNames')} />
        </SettingsRow>
        <SettingsRow label={t('enterToSend')}><Switch checked={enterToSend} onCheckedChange={setEnterToSend} label={t('enterToSend')} /></SettingsRow>
        <SettingsRow label={t('time')} hint={t('timeHint')}>
          <Switch
            checked={hourCycle === '24'}
            onCheckedChange={(on) => {
              const next = on ? '24' : '12'
              setHourCycle(next)
              localStorage.setItem('ma.time', next)
            }}
            label={t('hour24')}
          />
        </SettingsRow>
        <SettingsRow label={t('relayOnly')} hint={t('relayOnlyHint')}><Switch checked={relay} onCheckedChange={setRelay} label={t('relayOnly')} /></SettingsRow>
        <SettingsRow label={t('vaultPassword')}>
          <Button variant="outline" onClick={() => void changeVaultPassword(window.prompt(t('currentPassword')) || '', window.prompt(t('newPassword')) || '')}>{t('change')}</Button>
        </SettingsRow>
        <SettingsRow label={t('recoveryKey')} hint={t('recoveryKeyHint')}>
          <Button variant="outline" onClick={() => void addRecoverySlot().then((k) => toast(k))}>{t('create')}</Button>
        </SettingsRow>
        <SettingsRow label={t('devices')}>
          <Button variant="outline" onClick={() => void startPair()}>{t('linkDevice')}</Button>
        </SettingsRow>
        {pairCode ? <p className="px-4 py-2 font-mono text-sm">{pairCode}</p> : null}
        {pairQr ? <img alt={t('pairingQr')} src={pairQr} className="m-4 size-40" /> : null}
        <SettingsRow label={t('confirmPairing')}>
          <Button variant="outline" onClick={() => void claimPair(pairCode, pairCode, loadDevicePublicKeys()?.x25519 ?? '')}>{t('confirm')}</Button>
        </SettingsRow>
        <SettingsRow label={t('twoFactor')}>
          <Button variant="outline" onClick={() => void api('/v1/auth/2fa/totp/setup', { method: 'POST' }).then((r) => toast(JSON.stringify(r)))}>{t('setupTotp')}</Button>
        </SettingsRow>
        <SettingsRow label={t('lock')}>
          <Button variant="ghost" onClick={() => { lockVault(); setUnlocked(false) }}>{t('lockVault')}</Button>
        </SettingsRow>
      </SettingsSection>
    </AppSettings>
  ) : null

  if (mode !== 'app') {
    return (
      <form className="mx-auto max-w-md space-y-3" onSubmit={mode === 'register' ? onRegister : mode === '2fa' ? on2fa : onLogin}>
        <PageHeader title={mode === 'register' ? t('createAccount') : mode === '2fa' ? t('twoFactorCode') : t('signIn')} lead={t('signInLead')} />
        {mode === 'register' ? <Input placeholder={t('inviteCode')} value={invite} onChange={(e) => setInvite(e.target.value)} required /> : null}
        {mode !== '2fa' ? <Input placeholder={t('username')} value={username} onChange={(e) => setUsername(e.target.value)} required /> : null}
        {mode === 'register' ? <Input placeholder={t('displayName')} value={display} onChange={(e) => setDisplay(e.target.value)} /> : null}
        {mode !== '2fa' ? <Input type="password" placeholder={t('accountPassword')} value={password} onChange={(e) => setPassword(e.target.value)} required /> : null}
        {mode === '2fa' ? <Input placeholder={t('code')} value={code} onChange={(e) => setCode(e.target.value)} required /> : null}
        <Button type="submit">{mode === 'register' ? t('register') : t('continue')}</Button>
        {mode === 'login' ? <button type="button" className="block text-sm text-muted" onClick={() => setMode('register')}>{t('haveInvite')}</button> : null}
      </form>
    )
  }

  if (!unlocked) {
    return (
      <>
        {chatSettings}
        <form className="mx-auto max-w-md space-y-3" onSubmit={onUnlock}>
          <PageHeader title={t('unlockChat')} lead={t('unlockLead')} />
          <Input type="password" placeholder={t('vaultPassword')} value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} required />
          <Button type="submit">{t('unlock')}</Button>
        </form>
      </>
    )
  }

  return (
    <>
    {chatSettings}
    <div className="-mx-4 -mt-6 grid min-h-[calc(100dvh-3.5rem)] md:grid-cols-[18rem_1fr]">
      <aside className="border-r border-line p-3">
        <form onSubmit={addContact} className="mb-3 flex gap-2">
          <Input placeholder={t('friendUsername')} value={lookup} onChange={(e) => setLookup(e.target.value)} />
          <Button type="submit" variant="outline">{t('add')}</Button>
        </form>
        {pendingSync ? <p className="mb-2 text-xs text-muted">{t('syncHint')}</p> : null}
        <div className="space-y-1">
          {conversations.map((c) => (
            <div key={c.id} role="button" tabIndex={0} className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-surface-2 ${c.id === active ? 'bg-surface-2' : ''}`} onClick={() => setActive(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActive(c.id) }}>
              <span className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProfileButton username={c.peer_username || c.peer_name} displayName={c.peer_name}>
                  <UserAvatar username={c.peer_username || c.peer_name} />
                </ProfileButton>
                <span className="pointer-events-none absolute right-0 bottom-0"><PresenceDot online={online.has(c.peer_id)} /></span>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.peer_name || c.peer_username}</span>
            </div>
          ))}
          {contacts.filter((c) => c.state === 'accepted' && !conversations.some((conv) => conv.peer_id === c.id)).map((c) => (
            <div key={c.id} role="button" tabIndex={0} className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-surface-2" onClick={() => void openDirect(c.id, c.display_name || c.username)} onKeyDown={(e) => { if (e.key === 'Enter') void openDirect(c.id, c.display_name || c.username) }}>
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProfileButton username={c.username} displayName={c.display_name}>
                  <UserAvatar username={c.username} />
                </ProfileButton>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.display_name || c.username}</span>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex flex-col">
        {activeConv ? (
          <>
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <span onClick={(e) => e.stopPropagation()}>
                <ProfileButton username={activeConv.peer_username || activeConv.peer_name} displayName={activeConv.peer_name}>
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <UserAvatar username={activeConv.peer_username || activeConv.peer_name} className="size-8" />
                    {activeConv.peer_name || activeConv.peer_username}
                  </span>
                </ProfileButton>
              </span>
            </div>
            <DayDivider label={t('today')} />
            <div className="flex-1 space-y-1 overflow-auto px-4">
              {thread.map((m, i) => (
                <MessageBubble key={m.id} mine={m.mine} grouped={thread[i - 1]?.mine === m.mine} time={localTime(m.at, hourCycle)} status={m.status}>{m.body}</MessageBubble>
              ))}
              {typing?.conversationId === active ? <TypingIndicator name={typing.name || '…'} /> : null}
            </div>
            {transfer ? <div className="px-4"><TransferProgress name={transfer.name} value={transfer.value} onCancel={() => setTransfer(null)} /></div> : null}
            <form
              className="flex gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input aria-label={t('attachment')} type="file" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
              <Textarea
                className="min-h-12"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (e.target.value.trim() && activeConv) notifyTyping(activeConv.peer_id, activeConv.id)
                }}
                onKeyDown={(e) => {
                  if (enterToSend && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              <Button type="submit">{t('send')}</Button>
            </form>
          </>
        ) : (
          <p className="p-6 text-sm text-muted">{t('pickConversation')}</p>
        )}
      </section>
    </div>
    </>
  )
}

function localTime(iso: string, cycle: '24' | '12') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: cycle === '24' ? 'h23' : 'h12' })
}

function unhex(value: string) {
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
