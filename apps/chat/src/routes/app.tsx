import { ApiError, api, apiBlobProgress, apiUpload, authApi } from '@ma/api-client'
import { b64, pairingConfirm, ready, unb64 } from '@ma/crypto'
import { canonicalDisplayName, displayNameError, groupNameError, MAILBOX_MAX_FILE_BYTES, newFrame, passwordError, plaintextMessageSchema, usernameError } from '@ma/protocol'
import {
  AppSettings,
  Button,
  Dialog,
  HoldMenu,
  IconButton,
  Lightbox,
  ProfileButton,
  UserAvatar,
  DayDivider,
  Input,
  MessageAttachments,
  MessageBubble,
  type ChatFile,
  PresenceDot,
  TypingIndicator,
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
import { activeDatabase, hasLegacyVault, openAccount } from '../lib/db'
import { ensureDeviceSecrets, publicDeviceKeys, rememberDeviceSecrets, takeDeviceSecrets } from '../lib/device'
import { decryptFile, encryptFile } from '../lib/files'
import { copyLegacyVault } from '../lib/legacy'
import { replayOutbox } from '../lib/outbox'
import { dismissTransfer, loadPrefs, loadStorageGb, savePrefs as savePrefsStore, saveStorageGb, transferDismissed } from '../lib/prefs'
import { resetChatRuntime } from '../lib/runtime'
import { chunkMessages, exportHistory, storeHistory, type SyncMessage } from '../lib/sync'
import { useSession } from '../lib/session'
import { transport } from '../lib/transport'
import { AuthScreens } from '../features/auth/AuthScreens'
import { CreateGroup } from '../features/conversations/CreateGroup'
import { DeviceList } from '../features/devices/DeviceList'
import { formatBytes } from '../features/messages/format'
import { TransferPrompt } from '../features/transfers/TransferPrompt'
import { UnlockScreen } from '../features/vault/UnlockScreen'
import { addRecoverySlot, changeVaultPassword, cleanOldFiles, createVault, enforceStorageLimit, getIdentity, hasVault, importTransferredIdentity, isUnlocked, loadHistory, lockVault, readBytes, rememberBytes, sealRow, storageUsage, unlockVault, vaultOwner } from '../lib/vault'

type Me = { id: string; username: string; display_name: string; totp_enabled?: boolean }
type Contact = { id: string; username: string; display_name: string; state: string }
type Conversation = { id: string; kind?: string; title?: string; peer_id: string; peer_name: string; peer_username?: string; members?: { id: string; username: string; display_name: string; role: string }[] }
type LocalMessage = {
  id: string
  conversationId: string
  body: string
  mine: boolean
  at: string
  status: string
  senderId?: string
  files?: ChatFile[]
  deliveredAt?: string
  readAt?: string
}

type ChatPref = { pinned?: boolean; muted?: boolean }

export function ChatApp() {
  const { t } = useTranslation('common')
  const session = useSession()
  const [mode, setMode] = useState<'login' | 'register' | '2fa' | 'app'>('login')
  const [challenge, setChallenge] = useState('')
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<string | null>(null)
  const [lookup, setLookup] = useState('')
  const [enterToSend, setEnterToSend] = useState(true)
  const [relay, setRelay] = useState(false)
  const [showNames, setShowNames] = useState(() => localStorage.getItem('ma.chat.showSenderNames') === '1')
  const [transfer, setTransfer] = useState<{ title: string; loaded: number; total: number; startedAt: number; fileId: string; peerId: string } | null>(null)
  const [usage, setUsage] = useState({ chatBytes: 0, fileBytes: 0, total: 0 })
  const [limitGb, setLimitGb] = useState(() => loadStorageGb(''))
  const [pairId, setPairId] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [pairQr, setPairQr] = useState('')
  const [pairFingerprint, setPairFingerprint] = useState('')
  const [pendingSync, setPendingSync] = useState(false)
  const [askTransfer, setAskTransfer] = useState(false)
  const [allowFresh, setAllowFresh] = useState(false)
  const [legacyAvailable, setLegacyAvailable] = useState(false)
  const [vaultDialog, setVaultDialog] = useState(false)
  const [currentVaultPassword, setCurrentVaultPassword] = useState('')
  const [nextVaultPassword, setNextVaultPassword] = useState('')
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [typing, setTyping] = useState<{ conversationId: string; name: string } | null>(null)
  const typedAt = useRef(0)
  const outgoing = useRef(new Map<string, File>())
  const messagesRef = useRef<LocalMessage[]>([])
  const transferAbort = useRef<AbortController | null>(null)
  const abortFile = useRef('')
  const transferLock = useRef<string | null>(null)
  const transferEpoch = useRef(0)
  const cancelledFiles = useRef(new Set<string>())
  const incoming = useRef(new Map<string, { n: number; parts: Map<number, Uint8Array> }>())
  const fileApi = useRef({
    request: (_fileId: string, _userId: string) => {},
    chunk: (_payload: Record<string, unknown>, _from?: string) => {},
    done: (_fileId: string) => {},
    missing: (_fileId: string) => {},
  })
  const [hourCycle, setHourCycle] = useState<'24' | '12'>(() => (localStorage.getItem('ma.time') === '12' ? '12' : '24'))
  const [prefs, setPrefs] = useState<Record<string, ChatPref>>({})
  const tRef = useRef(t)
  tRef.current = t
  const [viewer, setViewer] = useState<{ src: string; name: string; kind: 'image' | 'video'; messageId: string; fileId: string; mine: boolean; via?: ChatFile['via'] } | null>(null)
  const [statusFor, setStatusFor] = useState<LocalMessage | null>(null)
  const wantView = useRef('')
  const transferPassword = useRef('')
  const syncSnapshot = useRef<SyncMessage[]>([])
  const syncReady = useRef<Promise<void>>(Promise.resolve())
  const syncRef = useRef<() => void>(() => {})
  const deviceSyncRef = useRef<() => void>(() => {})
  const publishSyncRef = useRef<(messages: SyncMessage[]) => void>(() => {})
  const filePull = useRef(new Map<string, { key: string; header: string; lengths: number[]; chunks: Uint8Array[]; name: string; mime: string }>())
  const meRef = useRef(session.user?.id)
  meRef.current = session.user?.id
  messagesRef.current = messages

  useEffect(() => {
    if (!unlocked) {
      setMessages([])
      return
    }
    void loadHistory().then(async (rows) => {
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      const aged = rows.map((row) => {
        const age = now - Date.parse(row.at)
        if (row.mine && age > day && (row.status === 'sent' || row.status === 'sending')) return { ...row, status: 'expired' }
        return row
      })
      setMessages(await attachCachedFiles(aged as LocalMessage[]))
      setUsage(await storageUsage())
    })
  }, [unlocked])

  useEffect(() => {
    const refreshSession = () => {
      void authApi.me().then(async (me) => {
        const current = useSession.getState()
        if (current.user && current.user.id !== me.id) resetChatRuntime()
        useSession.getState().setSession(me, me.device_id || null, me.trust_state || null)
        if (me.id) await openAccount(me.id)
        setMode('app')
      }).catch(() => {
        resetChatRuntime()
        setUnlocked(false)
        setMode('login')
      })
    }
    refreshSession()
    window.addEventListener('ma-auth', refreshSession)
    return () => window.removeEventListener('ma-auth', refreshSession)
  }, [])

  useEffect(() => {
    if (mode !== 'app' || !unlocked) return
    transport.relayOnly = relay
    transport.setLocalUser(session.user?.id || '')
    transport.connect()
    const sync = () => syncRef.current()
    const off = transport.on((frame) => {
      if (frame.t === 'session.ready') deviceSyncRef.current()
      if (frame.t === 'session.ready' || frame.t === 'mailbox.new' || frame.t === 'contacts.updated' || frame.t === 'conversations.updated') sync()
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
      if (frame.t === 'chat.read' || frame.t === 'chat.delivered') {
        const ids = Array.isArray(frame.p.message_ids) ? frame.p.message_ids.map(String) : []
        const status = frame.t === 'chat.read' ? 'read' : 'delivered'
        const now = new Date().toISOString()
        setMessages((prev) => prev.map((m) => {
          if (!m.mine || !ids.includes(m.id)) return m
          if (m.status === 'read' || m.status === status) return m
          const next = {
            ...m,
            status,
            deliveredAt: status === 'delivered' || status === 'read' ? m.deliveredAt || now : m.deliveredAt,
            readAt: status === 'read' ? m.readAt || now : m.readAt,
          }
          void sealRow('records', m.id, 'messages', withoutUrls(next))
          return next
        }))
      }
      if (frame.t === 'chat.expired') {
        const ids = Array.isArray(frame.p.message_ids) ? frame.p.message_ids.map(String) : []
        const files = Array.isArray(frame.p.file_ids) ? frame.p.file_ids.map(String) : []
        setMessages((prev) => prev.map((m) => {
          const hit = (m.mine && ids.includes(m.id)) || (m.mine && m.files?.some((file) => files.includes(file.id)))
          if (!hit || m.status === 'delivered' || m.status === 'read' || m.status === 'expired') return m
          const next = { ...m, status: 'expired' }
          void sealRow('records', m.id, 'messages', withoutUrls(next))
          return next
        }))
      }
      if (frame.t === 'p2p.message') {
        try {
          const parsed = JSON.parse(String(frame.p.data ?? '')) as {
            t?: string
            dek?: string
            signPk?: string
            signSk?: string
            boxPk?: string
            boxSk?: string
            file_id?: string
            key?: string
            header?: string
            lengths?: number[]
            name?: string
            mime?: string
            messages?: SyncMessage[]
            ids?: string[]
            source?: boolean
            final?: boolean
          }
          if ((parsed.t === 'sync.hello' || parsed.t === 'transfer.batch') && parsed.dek && parsed.signPk && parsed.signSk && parsed.boxPk && parsed.boxSk) {
            syncReady.current = (async () => {
              const local = isUnlocked() ? await exportHistory() : []
              syncSnapshot.current = local
              const same = isUnlocked() && getIdentity().identityBox.publicKey === parsed.boxPk
              if (same) return
              if ((await hasVault()) && !isUnlocked()) {
                toast(tRef.current('unlockBeforeSync'))
                syncSnapshot.current = []
                return
              }
              if (!transferPassword.current) return
              await importTransferredIdentity(transferPassword.current, { dek: parsed.dek || '', signPk: parsed.signPk || '', signSk: parsed.signSk || '', boxPk: parsed.boxPk || '', boxSk: parsed.boxSk || '' })
              if (local.length) await storeHistory(local)
              setUnlocked(true)
            })()
          }
          if (parsed.t === 'sync.records' && Array.isArray(parsed.messages)) {
            const inbound = parsed.messages
            const fromSource = parsed.source
            const done = parsed.final
            const peer = frame.from
            void syncReady.current.then(() => storeHistory(inbound)).then(async (merged) => {
              setMessages(await attachCachedFiles(merged as LocalMessage[]))
              setUsage(await storageUsage())
              if (fromSource && done && peer?.device) {
                transport.sendToPeer(peer.user, peer.device, JSON.stringify({ t: 'sync.records', messages: syncSnapshot.current, source: false, final: true }))
              }
            })
          }
          if (parsed.t === 'sync.manifest' && Array.isArray(parsed.ids) && frame.from?.device) {
            void exportHistory().then((history) => {
              const known = new Set(parsed.ids)
              const missing = history.filter((message) => !known.has(message.id))
              transport.sendToPeer(frame.from?.user || '', frame.from?.device || '', JSON.stringify({ t: 'sync.records', messages: missing, source: false, final: true }))
            })
          }
          if (parsed.t === 'file.start' && parsed.file_id && parsed.key && parsed.header && parsed.lengths) {
            filePull.current.set(parsed.file_id, { key: parsed.key, header: parsed.header, lengths: parsed.lengths, chunks: [], name: parsed.name || 'file', mime: parsed.mime || 'application/octet-stream' })
          }
          if (parsed.t === 'file.end' && parsed.file_id) {
            const slot = filePull.current.get(parsed.file_id)
            if (slot) {
              const total = slot.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
              const body = new Uint8Array(total)
              let cursor = 0
              for (const chunk of slot.chunks) {
                body.set(chunk, cursor)
                cursor += chunk.length
              }
              void decryptFile(body, slot.key, slot.header, slot.lengths).then((plain) => {
                const url = URL.createObjectURL(new Blob([plain], { type: slot.mime }))
                setMessages((prev) => prev.map((message) => ({ ...message, files: message.files?.map((item) => (item.id === parsed.file_id ? { ...item, url } : item)) })))
              })
              filePull.current.delete(parsed.file_id)
            }
          }
        } catch {
          // text envelopes are handled by mailbox and outbox paths
        }
      }
      if (frame.t === 'p2p.binary') {
        const bytes = frame.p.bytes
        if (bytes instanceof Uint8Array) {
          const slot = [...filePull.current.values()].at(-1)
          slot?.chunks.push(bytes)
        }
      }
      if (frame.t === 'chat.file.request') fileApi.current.request(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.chunk') fileApi.current.chunk(frame.p, frame.from?.user)
      if (frame.t === 'chat.file.done') fileApi.current.done(String(frame.p.file_id ?? ''))
      if (frame.t === 'chat.file.missing') fileApi.current.missing(String(frame.p.file_id ?? ''))
      if (frame.t === 'chat.file.cancel' || frame.t === 'chat.file.busy') {
        const fileId = String(frame.p.file_id ?? '')
        transferEpoch.current += 1
        if (fileId) cancelledFiles.current.add(fileId)
        incoming.current.delete(fileId)
        const active = !fileId || transferLock.current === fileId || abortFile.current === fileId
        if (active) {
          transferAbort.current?.abort()
          transferAbort.current = null
          abortFile.current = ''
          transferLock.current = null
          setDownloading(null)
          setTransfer(null)
        }
        if (frame.t === 'chat.file.busy') toast(tRef.current('transferBusy'))
      }
    })
    sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(sync, 8000)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [mode, unlocked, relay, session.user?.id])

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

  async function ensureDevice(userId: string) {
    await ready()
    return ensureDeviceSecrets(userId)
  }

  async function onLogin(values: { username: string; password: string }) {
    try {
      const tempId = `pending:${values.username.trim().toLowerCase()}`
      const keys = await ensureDevice(tempId)
      const res = await authApi.login({
        username: values.username,
        password: values.password,
        device: { name: navigator.userAgent.slice(0, 64) || 'browser', platform: navigator.platform, pk_ed25519: keys.ed25519, pk_x25519: keys.x25519 },
      })
      if (res.status === '2fa_required' && res.challenge_id) {
        setChallenge(res.challenge_id)
        setMode('2fa')
        return
      }
      if (res.user) {
        if (session.user && session.user.id !== res.user.id) resetChatRuntime()
        const secret = takeDeviceSecrets(tempId)
        if (secret) rememberDeviceSecrets(res.user.id, secret)
        session.setSession(res.user, res.device?.id ?? null, res.device?.trust_state ?? null)
        await openAccount(res.user.id)
        setPrefs(loadPrefs(res.user.id))
        setLimitGb(loadStorageGb(res.user.id))
        setLegacyAvailable(await hasLegacyVault())
        if (res.device?.trust_state === 'pending' && !transferDismissed(res.user.id)) setAskTransfer(true)
      }
      setMode('app')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('couldNotRegister'))
    }
  }

  async function onRegister(values: { username: string; password: string; display: string; invite: string }) {
    const nameError = usernameError(values.username)
    const displayError = values.display ? displayNameError(values.display) : ''
    const passError = passwordError(values.password)
    if (nameError || displayError || passError) {
      toast(nameError || displayError || passError)
      return
    }
    try {
      await authApi.register({ invite_code: values.invite, username: values.username, password: values.password, display_name: canonicalDisplayName(values.display || values.username) })
      toast(t('accountCreated'))
      setMode('login')
    } catch (err) {
      toast(err instanceof ApiError && err.code === 'server_overloaded' ? t('registerOverloaded') : err instanceof Error ? err.message : t('couldNotRegister'))
    }
  }

  async function on2fa(nextCode: string) {
    const res = await authApi.login2fa({ challenge_id: challenge, code: nextCode }) as { user: Me; device: { id: string; trust_state: string } }
    session.setSession(res.user, res.device.id, res.device.trust_state)
    if (res.user.id) {
      await openAccount(res.user.id)
      if (res.device.trust_state === 'pending' && !transferDismissed(res.user.id)) setAskTransfer(true)
    }
    setMode('app')
  }

  async function publishIdentityIfEmpty() {
    const pubs = { ed25519: getIdentity().identitySign.publicKey, x25519: getIdentity().identityBox.publicKey }
    if (!session.user?.id) return
    const existing = await api<{ x25519: string }>(`/v1/contacts/${session.user.id}/keys`).catch(() => null)
    if (existing?.x25519 && existing.x25519 !== pubs.x25519) {
      toast(t('identityMismatch'))
      return
    }
    if (!existing?.x25519) await api('/v1/users/me/identity-keys', { method: 'PUT', body: JSON.stringify(pubs) })
  }

  async function onUnlock(password: string) {
    const passError = passwordError(password)
    if (passError) {
      toast(passError)
      return
    }
    try {
      if (session.user?.id) await openAccount(session.user.id)
      setLegacyAvailable(await hasLegacyVault())
      if (!(await hasVault())) {
        if (session.trust === 'pending' && !allowFresh) {
          setAskTransfer(true)
          return
        }
        await createVault(password)
        if (session.trust !== 'pending') await publishIdentityIfEmpty()
      } else {
        const owner = await vaultOwner()
        if (owner && session.user?.id && owner !== session.user.id) {
          toast(t('wrongVaultAccount'))
          return
        }
        try {
          await unlockVault(password)
        } catch {
          toast(t('wrongVaultPassword'))
          return
        }
        await publishIdentityIfEmpty()
      }
      setUnlocked(true)
    } catch (err) {
      toast(explain(err))
    }
  }

  async function onImportLegacy(password: string) {
    if (!session.user?.id) return
    await openAccount(session.user.id)
    const server = await api<{ x25519: string }>(`/v1/contacts/${session.user.id}/keys`).catch(() => ({ x25519: '' }))
    const copied = await copyLegacyVault(password, session.user.id, server.x25519 || '')
    if (!copied) {
      toast(t('legacyMismatch'))
      return
    }
    await unlockVault(password)
    setUnlocked(true)
  }

  async function drainMailbox() {
    const items = await api<{ id: string; envelope: string }[]>('/v1/mailbox/messages')
    for (const item of items) {
      try {
        const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(item.envelope), (c) => c.charCodeAt(0))))
        const decoded = transport.decryptEnvelope(raw)
        const parsed = plaintextMessageSchema.safeParse(JSON.parse(decoded))
        if (!parsed.success) continue
        const senderId = parsed.data.sender_id
        const files: ChatFile[] = parsed.data.attachments.map((file) => ({
          id: file.file_id,
          name: file.name,
          mime: file.mime,
          size: file.size,
          key: file.key,
          header: file.header,
          lengths: file.lengths,
          via: 'mailbox',
        }))
        const message: LocalMessage = {
          id: parsed.data.message_id || item.id,
          conversationId: parsed.data.conversation_id,
          body: parsed.data.body,
          mine: !!senderId && senderId === meRef.current,
          at: parsed.data.sent_at,
          status: 'delivered',
          deliveredAt: parsed.data.sent_at,
          senderId,
          files,
        }
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
        await sealRow('records', message.id, 'messages', withoutUrls(message))
        await api(`/v1/mailbox/messages/${item.id}/ack`, { method: 'POST' })
        if (senderId) transport.sendFrame(newFrame('chat.delivered', { message_ids: [message.id] }, { user: senderId }))
      } catch {
        continue
      }
    }
  }

  syncRef.current = () => {
    if (useSession.getState().trust === 'pending') return
    void refresh()
    void drainMailbox()
    void replayOutbox()
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
    const picked = pending
    if (!conv || (!text && picked.length === 0)) return
    if (picked.length && transferLock.current) {
      toast(t('transferBusy'))
      return
    }
    const id = crypto.randomUUID()
    const at = new Date().toISOString()
    setDraft('')
    setPending([])
    const files: ChatFile[] = []
    let activeFile = ''
    try {
      await ready()
      const reachable = conv.peer_id === session.user?.id || online.has(conv.peer_id)
      const who = conv.peer_id === session.user?.id ? t('savedMessages') : (conv.peer_name || conv.peer_username || '')
      for (const file of picked) {
        const fileId = crypto.randomUUID()
        const name = file.name || 'file'
        const mime = file.type || 'application/octet-stream'
        const url = URL.createObjectURL(file)
        if (shouldKeep(mime, file.size)) void keepBytes(fileId, file)
        if (file.size >= MAILBOX_MAX_FILE_BYTES) {
          outgoing.current.set(fileId, file)
          if (!reachable) toast(t('fileTooBig', { name: who || name }))
          files.push({ id: fileId, name, mime, size: file.size, via: 'peer', url })
          continue
        }
        const encrypted = await encryptFile(file)
        const recipients = conv.kind === 'group' ? (conv.members || []).map((member) => member.id).filter((id) => id && id !== session.user?.id) : [conv.peer_id]
        transferLock.current = fileId
        activeFile = fileId
        const upload = new AbortController()
        transferAbort.current = upload
        abortFile.current = fileId
        for (const recipientId of recipients) {
          const form = new FormData()
          form.set('file', new File([encrypted.bytes], `${fileId}.bin`, { type: 'application/octet-stream' }))
          form.set('conversation_id', conv.id)
          form.set('recipient_user_id', recipientId)
          form.set('file_id', fileId)
          form.set('envelope', b64(new TextEncoder().encode(JSON.stringify({ alg: 'secretstream', name, mime, size: file.size, key: encrypted.key, header: encrypted.header, lengths: encrypted.lengths }))))
          await apiUpload('/v1/mailbox/files', form, (loaded, total) => {
            if (upload.signal.aborted || cancelledFiles.current.has(fileId)) return
            bumpTransfer('send', loaded, total, fileId, recipientId)
          }, upload.signal)
        }
        files.push({ id: fileId, name, mime, size: file.size, via: 'mailbox', url, key: encrypted.key, header: encrypted.header, lengths: encrypted.lengths })
      }
      const message: LocalMessage = { id, conversationId: conv.id, body: text, mine: true, at, status: 'sending', senderId: session.user?.id, files }
      setMessages((prev) => [...prev, message])
      const payload = JSON.stringify({
        message_id: id,
        conversation_id: conv.id,
        sent_at: at,
        kind: files.length ? 'file_offer' : 'text',
        body: text,
        sender_id: session.user?.id,
        attachments: files.map((file) => ({ file_id: file.id, name: file.name, mime: file.mime, size: file.size, key: file.key, header: file.header, lengths: file.lengths })),
      })
      const keys = await api<{ x25519: string }>(`/v1/contacts/${conv.peer_id}/keys`)
      const devices = conv.kind === 'group' ? [] : await api<{ id: string; x25519: string }[]>(`/v1/contacts/${conv.peer_id}/devices`).catch(() => [])
      const recipients = conv.kind === 'group' ? (conv.members || []).filter((member) => member.id !== session.user?.id) : [{ id: conv.peer_id, username: '', display_name: '', role: 'member' }]
      for (const recipient of recipients) {
        const recipientKeys = recipient.id === conv.peer_id ? keys : await api<{ x25519: string }>(`/v1/contacts/${recipient.id}/keys`)
        const deviceId = devices[0]?.id || ''
        await transport.deliverText({ id, conversationId: conv.id, recipientUserId: recipient.id, state: 'queued', envelope: payload, size: payload.length, attempts: 0 }, recipientKeys.x25519, deviceId)
      }
      setMessages((prev) => prev.map((m) => {
        if (m.id !== id) return m
        if (m.status !== 'sending' && m.status !== 'failed') return m
        const sent = { ...m, status: 'sent' }
        void sealRow('records', id, 'messages', withoutUrls(sent))
        publishSyncRef.current([withoutUrls(sent)])
        return sent
      }))
      const finished = activeFile
      window.setTimeout(() => {
        setTransfer((cur) => (cur?.fileId === finished ? null : cur))
        if (transferLock.current === finished) transferLock.current = null
      }, 600)
    } catch (err) {
      if (transferLock.current === activeFile) transferLock.current = null
      setTransfer((cur) => (cur?.fileId === activeFile ? null : cur))
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)))
      toast(explain(err))
    }
  }

  function peerLabel(peerId: string) {
    if (!peerId || peerId === session.user?.id) return t('savedMessages')
    const conv = conversations.find((c) => c.peer_id === peerId)
    const contact = contacts.find((c) => c.id === peerId)
    return conv?.peer_name || contact?.display_name || conv?.peer_username || contact?.username || ''
  }

  function transferTitle(role: 'send' | 'receive', peerId: string) {
    if (role === 'receive') return t('received')
    const name = peerLabel(peerId)
    return name ? t('receiverReceived', { name }) : t('received')
  }

  function bumpTransfer(role: 'send' | 'receive', loaded: number, total: number, fileId: string, peerId: string) {
    if (cancelledFiles.current.has(fileId) || transferLock.current !== fileId) return
    const title = transferTitle(role, peerId)
    setTransfer((prev) => {
      if (cancelledFiles.current.has(fileId) || transferLock.current !== fileId) return prev?.fileId === fileId ? null : prev
      return { title, loaded, total, fileId, peerId, startedAt: prev?.fileId === fileId ? prev.startedAt : Date.now() }
    })
  }

  function stopTransfer() {
    const current = transfer
    const fileId = current?.fileId ?? ''
    transferEpoch.current += 1
    if (fileId) cancelledFiles.current.add(fileId)
    if (transferLock.current === fileId) transferLock.current = null
    abortFile.current = ''
    transferAbort.current?.abort()
    transferAbort.current = null
    if (fileId) incoming.current.delete(fileId)
    if (current?.peerId && fileId) transport.sendFrame(newFrame('chat.file.cancel', { file_id: fileId }, { user: current.peerId }))
    setDownloading(null)
    setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
  }

  async function keepBytes(id: string, file: Blob) {
    if (!shouldKeep(file.type, file.size)) return
    const removed = await rememberBytes(id, new Uint8Array(await file.arrayBuffer()))
    if (removed.length) setMessages((prev) => prev.filter((message) => !removed.includes(message.id)))
    setUsage(await storageUsage())
  }

  function explain(err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'server_overloaded') return t('serverOverloaded')
      if (err.code === 'not_found' || err.status === 404) return t('fileGone')
      if (err.code === 'too_large') return t('fileTooLarge')
    }
    return err instanceof Error ? err.message : t('couldNotSend')
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

  function attachFiles(list: File[]) {
    if (!active) {
      toast(t('pickConversation'))
      return
    }
    setPending((prev) => [...prev, ...list])
  }

  async function fetchMailbox(message: LocalMessage, file: ChatFile, ack: boolean) {
    let url = file.url
    if (!url) {
      const cached = await readBytes(file.id)
      if (cached) url = URL.createObjectURL(new Blob([new Uint8Array(cached)], { type: file.mime || 'application/octet-stream' }))
    }
    if (!url) {
      if (transferLock.current && transferLock.current !== file.id) {
        toast(t('transferBusy'))
        return
      }
      cancelledFiles.current.delete(file.id)
      transferLock.current = file.id
      const download = new AbortController()
      transferAbort.current = download
      abortFile.current = file.id
      setDownloading(file.id)
      try {
        const blob = await apiBlobProgress(`/v1/mailbox/files/${file.id}`, (loaded, total) => {
          if (download.signal.aborted || cancelledFiles.current.has(file.id)) return
          bumpTransfer('receive', loaded, total || file.size, file.id, message.senderId || '')
        }, download.signal)
        if (cancelledFiles.current.has(file.id)) return
        let plain = new Uint8Array(await blob.arrayBuffer())
        if (file.key && file.header && file.lengths?.length) plain = await decryptFile(plain, file.key, file.header, file.lengths)
        const decoded = new Blob([plain], { type: file.mime || 'application/octet-stream' })
        url = URL.createObjectURL(decoded)
        void keepBytes(file.id, decoded)
        setTransfer((cur) => (cancelledFiles.current.has(file.id) || cur?.fileId !== file.id ? cur : { ...cur, title: t('received'), loaded: cur.total || blob.size }))
        window.setTimeout(() => {
          setTransfer((cur) => (cur?.fileId === file.id ? null : cur))
          if (transferLock.current === file.id) transferLock.current = null
        }, 600)
      } catch (err) {
        if (transferLock.current === file.id) transferLock.current = null
        if (!(err instanceof DOMException && err.name === 'AbortError') && !(file.via === 'peer' && err instanceof ApiError && (err.status === 404 || err.code === 'not_found'))) throw err
      }
      setDownloading(null)
    }
    if (!url && file.via === 'peer') {
      const conv = conversations.find((c) => c.id === message.conversationId)
      if (!conv) throw new Error(t('couldNotSend'))
      const peer = conv.peer_id === session.user?.id ? session.user.id : conv.peer_id
      transport.sendFrame(newFrame('chat.file.request', { file_id: file.id }, { user: peer }))
      return
    }
    if (url) setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, files: m.files?.map((item) => (item.id === file.id ? { ...item, url } : item)) } : m)))
    if (ack && url && !message.mine && file.via !== 'peer') await api(`/v1/mailbox/files/${file.id}/ack`, { method: 'POST' })
    return url
  }

  function missFile(message: LocalMessage, err: unknown) {
    if (err instanceof ApiError && (err.code === 'not_found' || err.status === 404) && message.mine && message.status !== 'delivered' && message.status !== 'read') {
      const next = { ...message, status: 'expired' }
      setMessages((prev) => prev.map((m) => (m.id === message.id ? next : m)))
      void sealRow('records', message.id, 'messages', withoutUrls(next))
    }
    toast(explain(err))
  }

  async function saveFile(message: LocalMessage, file: ChatFile) {
    try {
      const url = await fetchMailbox(message, file, true)
      if (!url) return
      const link = document.createElement('a')
      link.href = url
      link.download = file.name || 'file'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setDownloading(null)
      setTransfer(null)
      missFile(message, err)
    }
  }

  async function shareFile(message: LocalMessage, file: ChatFile) {
    const url = file.url || await fetchMailbox(message, file, false)
    if (!url) return
    try {
      const blob = await fetch(url).then((res) => res.blob())
      const shared = new File([blob], file.name || 'file', { type: file.mime || blob.type })
      if (navigator.canShare?.({ files: [shared] })) {
        await navigator.share({ files: [shared], title: shared.name })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: file.name, url })
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast(t('shareUnavailable'))
      return
    }
    toast(t('shareUnavailable'))
  }

  async function viewFile(message: LocalMessage, file: ChatFile) {
    const kind = file.mime.startsWith('video/') ? 'video' : file.mime.startsWith('image/') ? 'image' : null
    if (!kind) return
    try {
    const open = (src: string) => setViewer({ src, name: file.name, kind, messageId: message.id, fileId: file.id, mine: message.mine, via: file.via })
    if (file.url) {
      open(file.url)
      return
    }
    wantView.current = file.id
    const url = await fetchMailbox(message, file, false)
    if (url) {
      wantView.current = ''
      open(url)
    }
    } catch (err) {
      setDownloading(null)
      setTransfer(null)
      missFile(message, err)
    }
  }

  fileApi.current.request = (fileId, userId) => {
    void (async () => {
      cancelledFiles.current.delete(fileId)
      let file = outgoing.current.get(fileId)
      if (!file) {
        const bytes = await readBytes(fileId)
        if (bytes) {
          const meta = messagesRef.current.flatMap((message) => message.files ?? []).find((item) => item.id === fileId)
          file = new File([new Uint8Array(bytes)], meta?.name || 'file', { type: meta?.mime || 'application/octet-stream' })
          outgoing.current.set(fileId, file)
        }
      }
      if (cancelledFiles.current.has(fileId)) return
      if (transferLock.current && transferLock.current !== fileId) {
        if (userId) transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: userId }))
        return
      }
      if (!file || !userId) {
        if (userId) transport.sendFrame(newFrame('chat.file.missing', { file_id: fileId }, { user: userId }))
        return
      }
      await sendFileChunks(file, fileId, userId)
    })()
  }
  fileApi.current.chunk = (payload, fromUser) => {
    const fileId = String(payload.file_id ?? '')
    const index = Number(payload.i ?? 0)
    const total = Number(payload.n ?? 0)
    const data = String(payload.data ?? '')
    if (!fileId || !total || !data || cancelledFiles.current.has(fileId)) return
    if (transferLock.current && transferLock.current !== fileId) {
      if (fromUser) transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: fromUser }))
      return
    }
    transferLock.current = fileId
    const slot = incoming.current.get(fileId) ?? { n: total, parts: new Map<number, Uint8Array>() }
    slot.n = total
    slot.parts.set(index, unb64(data))
    incoming.current.set(fileId, slot)
    const loaded = [...slot.parts.values()].reduce((sum, part) => sum + part.byteLength, 0)
    bumpTransfer('receive', loaded, Number(payload.size ?? 0) || loaded, fileId, fromUser || '')
    if (slot.parts.size >= total) finishIncoming(fileId)
  }
  fileApi.current.done = (fileId) => finishIncoming(fileId)
  fileApi.current.missing = (fileId) => {
    void (async () => {
      const cached = await readBytes(fileId)
      if (cached) {
        const url = URL.createObjectURL(new Blob([new Uint8Array(cached)]))
        setMessages((prev) => prev.map((message) => ({ ...message, files: message.files?.map((item) => (item.id === fileId ? { ...item, url } : item)) })))
        setDownloading(null)
        return
      }
      if (downloading === fileId) setDownloading(null)
      setTransfer(null)
      toast(t('fileMissing'))
    })()
  }

  async function sendFileChunks(file: File, fileId: string, userId: string) {
    if (transferLock.current && transferLock.current !== fileId) {
      if (userId) transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: userId }))
      return
    }
    transferLock.current = fileId
    const devices = await api<{ id: string }[]>(`/v1/contacts/${userId}/devices`).catch(() => [])
    const deviceId = devices[0]?.id || ''
    const channel = deviceId ? await transport.ensurePeer(userId, deviceId) : null
    if (!channel || channel.readyState !== 'open') {
      toast(t('waitingPeer'))
      if (transferLock.current === fileId) transferLock.current = null
      return
    }
    const encrypted = await encryptFile(file)
    channel.send(JSON.stringify({ t: 'file.start', file_id: fileId, name: file.name, mime: file.type, size: file.size, key: encrypted.key, header: encrypted.header, lengths: encrypted.lengths }))
    const size = 64 * 1024
    for (let offset = 0; offset < encrypted.bytes.length; offset += size) {
      channel.send(encrypted.bytes.subarray(offset, Math.min(encrypted.bytes.length, offset + size)))
      bumpTransfer('send', offset, file.size, fileId, userId)
    }
    channel.send(JSON.stringify({ t: 'file.end', file_id: fileId }))
    window.setTimeout(() => {
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      if (transferLock.current === fileId) transferLock.current = null
    }, 600)
  }

  function finishIncoming(fileId: string) {
    if (cancelledFiles.current.has(fileId)) {
      incoming.current.delete(fileId)
      return
    }
    const slot = incoming.current.get(fileId)
    if (!slot || slot.parts.size < slot.n) return
    const parts: Uint8Array[] = []
    for (let index = 0; index < slot.n; index++) {
      const part = slot.parts.get(index)
      if (!part) return
      parts.push(part)
    }
    incoming.current.delete(fileId)
    setMessages((prev) => {
      let mime = 'application/octet-stream'
      let label = 'file'
      for (const message of prev) {
        const file = message.files?.find((item) => item.id === fileId)
        if (file) {
          mime = file.mime
          label = file.name
        }
      }
      const buffers = parts.map((part) => new Uint8Array(part))
      const blob = new Blob(buffers, { type: mime })
      const url = URL.createObjectURL(blob)
      void keepBytes(fileId, blob)
      if (wantView.current === fileId && (mime.startsWith('image/') || mime.startsWith('video/'))) {
        wantView.current = ''
        const owner = prev.find((message) => message.files?.some((item) => item.id === fileId))
        setViewer({ src: url, name: label, kind: mime.startsWith('video/') ? 'video' : 'image', messageId: owner?.id ?? '', fileId, mine: !!owner?.mine, via: owner?.files?.find((item) => item.id === fileId)?.via })
      }
      return prev.map((message) => ({
        ...message,
        files: message.files?.map((file) => (file.id === fileId ? { ...file, url } : file)),
      }))
    })
    setDownloading(null)
    setTransfer((cur) => (cur?.fileId === fileId ? { ...cur, title: t('received'), loaded: cur.total || cur.loaded } : cur))
    window.setTimeout(() => {
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      if (transferLock.current === fileId) transferLock.current = null
    }, 600)
  }

  async function startPair() {
    if (!session.user) return
    const keys = ensureDeviceSecrets(session.user.id)
    const res = await api<{ pairing_id: string; code: string }>('/v1/devices/pairing', { method: 'POST' })
    setPairId(res.pairing_id)
    setPairCode(res.code)
    setPairQr(await QRCode.toDataURL(JSON.stringify({ pairing_id: res.pairing_id, pk: keys.x25519, code: res.code })))
  }

  async function approvePair() {
    if (!pairId || !session.user) return
    const local = publicDeviceKeys(session.user.id)
    const status = await api<{ state: string; fingerprint?: string; target_device_id?: string; target_x25519?: string }>(`/v1/devices/pairing/${pairId}`)
    if (status.state !== 'claimed' || !status.target_device_id || !status.target_x25519 || !local) {
      toast(t('waitingPeer'))
      return
    }
    setPairFingerprint(status.fingerprint || '')
    const tag = pairingConfirm(pairCode, unb64(local.x25519), unb64(status.target_x25519), pairId)
    await api(`/v1/devices/pairing/${pairId}/confirm`, { method: 'POST', body: JSON.stringify({ tag }) })
    const channel = await transport.ensurePeer(session.user.id, status.target_device_id)
    if (channel && channel.readyState === 'open' && isUnlocked()) {
      const identity = getIdentity()
      const history = await exportHistory()
      channel.send(JSON.stringify({
        t: 'sync.hello',
        dek: b64(identity.dek),
        signPk: identity.identitySign.publicKey,
        signSk: b64(identity.identitySign.privateKey),
        boxPk: identity.identityBox.publicKey,
        boxSk: b64(identity.identityBox.privateKey),
      }))
      const batches = chunkMessages(history)
      if (!batches.length) channel.send(JSON.stringify({ t: 'sync.records', messages: [], source: true, final: true }))
      batches.forEach((messages, index) => {
        channel.send(JSON.stringify({ t: 'sync.records', messages, source: true, final: index === batches.length - 1 }))
      })
    }
    await api(`/v1/devices/pairing/${pairId}/complete`, { method: 'POST' })
    toast(t('transferDone'))
  }

  async function claimPair(pairingId: string, codeValue: string) {
    const local = session.user ? publicDeviceKeys(session.user.id) : null
    if (!pairingId || !local?.x25519 || !codeValue) return
    try {
      const claimed = await api<{ device_id: string; fingerprint: string }>(`/v1/devices/pairing/${pairingId}/claim`, { method: 'POST', body: JSON.stringify({ code: codeValue }) })
      setPairFingerprint(claimed.fingerprint)
      if (session.user?.id) transport.setLocalUser(session.user.id)
      transport.connect()
      toast(t('confirmPairing'))
    } catch (err) {
      toast(explain(err))
    }
  }

  deviceSyncRef.current = () => {
    const user = session.user
    if (!user || session.trust === 'pending' || !isUnlocked()) return
    void (async () => {
      const devices = await api<{ id: string; trust_state: string; current?: boolean }[]>('/v1/devices').catch(() => [])
      const ids = (await exportHistory()).map((message) => message.id)
      for (const device of devices) {
        if (device.current || device.trust_state !== 'trusted') continue
        const channel = await transport.ensurePeer(user.id, device.id).catch(() => null)
        if (channel?.readyState === 'open') channel.send(JSON.stringify({ t: 'sync.manifest', ids }))
      }
    })()
  }
  publishSyncRef.current = (messages) => {
    const user = session.user
    if (!user || session.trust === 'pending' || !messages.length) return
    void (async () => {
      const devices = await api<{ id: string; trust_state: string; current?: boolean }[]>('/v1/devices').catch(() => [])
      for (const device of devices) {
        if (device.current || device.trust_state !== 'trusted') continue
        const channel = await transport.ensurePeer(user.id, device.id).catch(() => null)
        if (channel?.readyState === 'open') channel.send(JSON.stringify({ t: 'sync.records', messages, source: false, final: true }))
      }
    })()
  }

  const thread = useMemo(() => messages.filter((m) => m.conversationId === active), [messages, active])
  const activeConv = conversations.find((c) => c.id === active)
  const me = session.user?.id
  const selfChat = !!me && activeConv?.peer_id === me

  useEffect(() => {
    if (!active || !activeConv) return
    const ids = messages.filter((m) => m.conversationId === active && m.status !== 'read' && m.status !== 'expired' && m.status !== 'failed' && (selfChat ? m.mine : !m.mine)).map((m) => m.id)
    if (!ids.length) return
    const now = new Date().toISOString()
    if (!selfChat) transport.sendFrame(newFrame('chat.read', { message_ids: ids }, { user: activeConv.peer_id }))
    setMessages((prev) => prev.map((m) => {
      if (!ids.includes(m.id)) return m
      const next = { ...m, status: 'read', readAt: m.readAt || now, deliveredAt: m.deliveredAt || now }
      void sealRow('records', m.id, 'messages', withoutUrls(next))
      return next
    }))
  }, [active, activeConv, messages, selfChat])

  function savePrefs(next: Record<string, ChatPref>) {
    setPrefs(next)
    if (session.user?.id) savePrefsStore(session.user.id, next)
  }

  function togglePref(conversationId: string, key: 'pinned' | 'muted') {
    const current = prefs[conversationId] ?? {}
    savePrefs({ ...prefs, [conversationId]: { ...current, [key]: !current[key] } })
  }

  async function clearHistory(conversationId: string) {
    if (!window.confirm(t('clearHistoryConfirm'))) return
    const ids = messages.filter((m) => m.conversationId === conversationId).map((m) => m.id)
    setMessages((prev) => prev.filter((m) => m.conversationId !== conversationId))
    await Promise.all(ids.map((id) => activeDatabase().records.delete(id)))
  }

  async function setBlocked(userId: string, blocked: boolean) {
    if (!userId || userId === me) return
    await api(`/v1/contacts/${userId}/block`, { method: blocked ? 'POST' : 'DELETE' })
    await refresh()
  }

  function blocked(userId: string) {
    return contacts.some((c) => c.id === userId && c.state === 'blocked')
  }

  function convTitle(c: Conversation) {
    if (c.kind === 'group') return c.title || t('newGroup')
    if (me && c.peer_id === me) return t('savedMessages')
    return c.peer_name || c.peer_username || ''
  }

  function contactMenu(c: Conversation) {
    const self = c.peer_id === me
    const pref = prefs[c.id] ?? {}
    const items = [
      { id: 'pin', label: pref.pinned ? t('unpin') : t('pin'), onSelect: () => togglePref(c.id, 'pinned') },
      { id: 'clear', label: t('clearHistory'), onSelect: () => void clearHistory(c.id) },
    ]
    if (c.kind === 'group') {
      items.push({ id: 'leave', label: t('leaveGroup'), onSelect: () => void api(`/v1/conversations/${c.id}/leave`, { method: 'POST' }).then(() => refresh()) })
    } else if (!self) {
      items.push({ id: 'mute', label: pref.muted ? t('unmute') : t('mute'), onSelect: () => togglePref(c.id, 'muted') })
      items.push({ id: 'block', label: blocked(c.peer_id) ? t('unblock') : t('block'), onSelect: () => void setBlocked(c.peer_id, !blocked(c.peer_id)) })
    }
    return items
  }

  function profileActions(userId: string, conversationId?: string) {
    if (!userId || userId === me) return []
    const pref = conversationId ? prefs[conversationId] : undefined
    const items = []
    if (conversationId) items.push({ id: 'mute', label: pref?.muted ? t('unmute') : t('mute'), onSelect: () => togglePref(conversationId, 'muted') })
    items.push({ id: 'block', label: blocked(userId) ? t('unblock') : t('block'), onSelect: () => void setBlocked(userId, !blocked(userId)) })
    return items
  }

  const statusMessage = statusFor ? messages.find((m) => m.id === statusFor.id) ?? statusFor : null
  const orderedConversations = [...conversations].sort((a, b) => {
    const pin = Number(!!prefs[b.id]?.pinned) - Number(!!prefs[a.id]?.pinned)
    if (pin) return pin
    return lastAt(messages, b.id) - lastAt(messages, a.id)
  })

  const openMa = useRef<(username: string) => Promise<void>>(async () => {})
  openMa.current = async (username) => {
    try {
      if (session.user && session.user.username.toLowerCase() === username.toLowerCase()) {
        await openDirect(session.user.id, session.user.display_name || session.user.username)
        window.dispatchEvent(new Event('ma-close-settings'))
        return
      }
      try {
        await api('/v1/contacts', { method: 'POST', body: JSON.stringify({ username }) })
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.code === 'not_found')) {
          toast(t('notFound'))
          return
        }
      }
      const list = await api<Contact[]>('/v1/contacts')
      const person = list.find((item) => item.username.toLowerCase() === username.toLowerCase())
      if (!person) {
        toast(t('notFound'))
        return
      }
      setContacts(list)
      await openDirect(person.id, person.display_name || person.username)
      window.dispatchEvent(new Event('ma-close-settings'))
    } catch (err) {
      toast(explain(err))
    }
  }

  useEffect(() => {
    const onWrite = (event: Event) => {
      const username = String((event as CustomEvent).detail || 'ma').replace(/^@/, '')
      void openMa.current(username)
    }
    window.addEventListener('ma-write', onWrite)
    return () => window.removeEventListener('ma-write', onWrite)
  }, [])

  const chatSettings = session.user ? (
    <AppSettings>
      <SettingsSection title={t('chat')}>
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
        <SettingsRow label={t('showSenderNames')} hint={t('showSenderNamesHint')}>
          <Switch
            checked={showNames}
            onCheckedChange={(on) => {
              setShowNames(on)
              localStorage.setItem('ma.chat.showSenderNames', on ? '1' : '0')
              void navigator.serviceWorker?.controller?.postMessage({ type: 'notify-pref', show: on })
            }}
            label={t('showNames')}
          />
        </SettingsRow>
        <SettingsRow label={t('relayOnly')} hint={t('relayOnlyHint')}><Switch checked={relay} onCheckedChange={setRelay} label={t('relayOnly')} /></SettingsRow>
      </SettingsSection>
      <SettingsSection title={t('onThisDevice')}>
        <SettingsRow label={t('storageUsed')} hint={`${t('storageChats', { size: formatBytes(usage.chatBytes) })} · ${t('storageFiles', { size: formatBytes(usage.fileBytes) })}`}>
          <span className="text-sm">{formatBytes(usage.total)}</span>
        </SettingsRow>
        <SettingsRow label={t('storageLimit')} hint={t('storageLimitHint')}>
          <span className="inline-flex items-center gap-2">
            <Input
              className="h-9 w-16 text-center"
              inputMode="numeric"
              aria-label={t('storageLimit')}
              value={limitGb === 0 ? '∞' : String(limitGb)}
              onChange={(e) => {
                const text = e.target.value.replace(/[^\d]/g, '')
                const next = text === '' ? 0 : Math.min(100, Number(text))
                setLimitGb(next)
                if (session.user?.id) saveStorageGb(session.user.id, next)
                if (next === 0) return
                void enforceStorageLimit().then(async (removed) => {
                  if (removed.length) setMessages((prev) => prev.filter((message) => !removed.includes(message.id)))
                  setUsage(await storageUsage())
                })
              }}
            />
            <span className="text-sm text-muted">GB</span>
          </span>
        </SettingsRow>
        <SettingsRow label={t('cleanStorage')}>
          <Button variant="outline" onClick={() => void cleanOldFiles().then(async (result) => {
            if (result.messageIds.length) setMessages((prev) => prev.filter((message) => !result.messageIds.includes(message.id)))
            setUsage(await storageUsage())
            const parts = []
            if (result.fileCount) parts.push(t('cleanStorageFiles', { count: result.fileCount, size: formatBytes(result.bytes) }))
            if (result.messageIds.length) parts.push(t('cleanStorageMessages', { count: result.messageIds.length }))
            toast(parts.length ? parts.join(' ') : t('cleanStorageEmpty'))
          })}>{t('cleanStorage')}</Button>
        </SettingsRow>
        <SettingsRow label={t('lock')}>
          <Button variant="ghost" className="h-auto max-w-full whitespace-normal py-2 text-left" onClick={() => { lockVault(); setUnlocked(false) }}>{t('lockVault')}</Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title={t('security')}>
        <SettingsRow label={t('vaultPassword')}>
          <Button variant="outline" onClick={() => setVaultDialog(true)}>{t('change')}</Button>
        </SettingsRow>
        <SettingsRow label={t('recoveryKey')} hint={t('recoveryKeyHint')}>
          <Button variant="outline" onClick={() => void addRecoverySlot().then((k) => toast(k))}>{t('create')}</Button>
        </SettingsRow>
        <SettingsRow label={t('devices')}>
          <Button variant="outline" onClick={() => void startPair()}>{t('linkDevice')}</Button>
        </SettingsRow>
        {pairId ? (
          <>
            {pairCode ? <p className="px-4 py-2 font-mono text-sm">{pairCode}</p> : null}
            {pairQr ? <img alt={t('pairingQr')} src={pairQr} className="m-4 size-40" /> : null}
            {pairFingerprint ? <p className="px-4 py-2 text-xs text-muted">{pairFingerprint}</p> : null}
            <SettingsRow label={t('confirmPairing')}>
              <Button variant="outline" onClick={() => void approvePair()}>{t('confirm')}</Button>
            </SettingsRow>
            <DeviceList enabled={mode === 'app'} userId={session.user?.id || ''} />
          </>
        ) : null}
        <SettingsRow label={t('twoFactor')}>
          <Button variant="outline" onClick={() => void api<{ otpauth_url?: string; secret?: string; recovery_codes?: string[] }>('/v1/auth/2fa/totp/setup', { method: 'POST' }).then((r) => toast(r.recovery_codes?.length ? t('recoveryCodesReady') : t('setupTotp')))}>{t('setupTotp')}</Button>
        </SettingsRow>
      </SettingsSection>
    </AppSettings>
  ) : null

  if (mode !== 'app') {
    return <AuthScreens mode={mode} onMode={setMode} onLogin={onLogin} onRegister={onRegister} on2fa={on2fa} />
  }

  if (!unlocked) {
    return (
      <>
        <UnlockScreen onUnlock={onUnlock} onImport={onImportLegacy} showImport={legacyAvailable} />
        <TransferPrompt
          open={askTransfer}
          onLater={() => {
            if (session.user?.id) dismissTransfer(session.user.id)
            setAskTransfer(false)
          }}
          onFresh={() => {
            setAllowFresh(true)
            setAskTransfer(false)
          }}
          onTransfer={async (pairingId, code, nextPassword) => {
            transferPassword.current = nextPassword
            await claimPair(pairingId, code)
            setAskTransfer(false)
          }}
        />
      </>
    )
  }

  return (
    <>
    {chatSettings}
    <Dialog open={vaultDialog} onOpenChange={setVaultDialog} title={t('vaultPassword')} description={t('vaultPasswordSeparate')}>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault()
        if (passwordError(nextVaultPassword)) {
          toast(passwordError(nextVaultPassword))
          return
        }
        void changeVaultPassword(currentVaultPassword, nextVaultPassword).then(() => {
          setVaultDialog(false)
          setCurrentVaultPassword('')
          setNextVaultPassword('')
        }).catch(() => toast(t('wrongVaultPassword')))
      }}>
        <Input type="password" placeholder={t('currentPassword')} aria-label={t('currentPassword')} value={currentVaultPassword} onChange={(e) => setCurrentVaultPassword(e.target.value)} />
        <Input type="password" placeholder={t('newPassword')} aria-label={t('newPassword')} value={nextVaultPassword} onChange={(e) => setNextVaultPassword(e.target.value)} />
        <Button type="submit">{t('change')}</Button>
      </form>
    </Dialog>
    <TransferPrompt
      open={askTransfer && !!unlocked}
      onLater={() => {
        if (session.user?.id) dismissTransfer(session.user.id)
        setAskTransfer(false)
      }}
      onFresh={() => {
        if (session.user?.id) dismissTransfer(session.user.id)
        setAskTransfer(false)
      }}
      onTransfer={async (pairingId, code, nextPassword) => {
        transferPassword.current = nextPassword
        await claimPair(pairingId, code)
        setAskTransfer(false)
      }}
    />
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={`${active ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-line md:flex md:border-r`}>
        <form onSubmit={addContact} className="flex shrink-0 gap-2 border-b border-line p-3">
          <Input placeholder={t('friendUsername')} aria-label={t('friendUsername')} value={lookup} onChange={(e) => setLookup(e.target.value)} />
          <Button type="submit" variant="outline" className="shrink-0">{t('add')}</Button>
          <CreateGroup contacts={contacts} onCreate={async (title, memberIds) => {
            if (groupNameError(title)) {
              toast(groupNameError(title))
              return
            }
            const conv = await api<Conversation>('/v1/conversations', { method: 'POST', body: JSON.stringify({ kind: 'group', title, member_ids: memberIds }) })
            setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [...prev, conv]))
            setActive(conv.id)
          }} />
        </form>
        {session.user && transferDismissed(session.user.id) ? <Button type="button" variant="ghost" className="mx-3 mt-2" onClick={() => setAskTransfer(true)}>{t('transferChats')}</Button> : null}
        {pendingSync ? <p className="shrink-0 px-3 pt-2 text-xs text-muted">{t('syncHint')}</p> : null}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {me && !conversations.some((c) => c.peer_id === me) ? (
            <button type="button" className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left hover:bg-surface-2" onClick={() => void openDirect(me, session.user?.display_name || '')}>
              <UserAvatar username={session.user?.username || ''} />
              <span className="truncate text-sm">{t('savedMessages')}</span>
            </button>
          ) : null}
          {orderedConversations.map((c) => {
            const latest = [...messages].reverse().find((m) => m.conversationId === c.id)
            const self = c.peer_id === me
            return (
            <HoldMenu key={c.id} label={convTitle(c)} items={contactMenu(c)}>
            <div role="button" tabIndex={0} className={`flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-left hover:bg-surface-2 ${c.id === active ? 'bg-surface-2' : ''}`} onClick={() => setActive(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActive(c.id) }}>
              <span className="relative shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProfileButton username={c.peer_username || c.peer_name} displayName={convTitle(c)} actions={profileActions(c.peer_id, c.id)}>
                  <UserAvatar username={c.peer_username || c.peer_name} />
                </ProfileButton>
                <span className="pointer-events-none absolute right-0 bottom-0"><PresenceDot online={self || online.has(c.peer_id)} /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{convTitle(c)}{!self && prefs[c.id]?.muted ? ` · ${t('mute')}` : ''}{!self && blocked(c.peer_id) ? ` · ${t('blocked')}` : ''}</span>
                {latest ? <span className="block truncate text-xs text-muted">{latest.body || latest.files?.[0]?.name}</span> : null}
              </span>
            </div>
            </HoldMenu>
            )
          })}
          {contacts.filter((c) => (c.state === 'accepted' || c.state === 'blocked') && c.id !== me && !conversations.some((conv) => conv.peer_id === c.id)).map((c) => (
            <HoldMenu key={c.id} label={c.display_name || c.username} items={[{ id: 'block', label: blocked(c.id) ? t('unblock') : t('block'), onSelect: () => void setBlocked(c.id, !blocked(c.id)) }]}>
            <div role="button" tabIndex={0} className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-left hover:bg-surface-2" onClick={() => void openDirect(c.id, c.display_name || c.username)} onKeyDown={(e) => { if (e.key === 'Enter') void openDirect(c.id, c.display_name || c.username) }}>
              <span className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProfileButton username={c.username} displayName={c.display_name} actions={profileActions(c.id)}>
                  <UserAvatar username={c.username} />
                </ProfileButton>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.display_name || c.username}{c.state === 'blocked' ? ` · ${t('blocked')}` : ''}</span>
            </div>
            </HoldMenu>
          ))}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col md:flex`}>
        {activeConv ? (
          <>
            <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2">
              <IconButton label={t('back')} className="md:hidden" onClick={() => setActive(null)}>
                <BackIcon />
              </IconButton>
              <ProfileButton className="min-w-0 flex-1" username={activeConv.peer_username || activeConv.peer_name} displayName={convTitle(activeConv)} actions={profileActions(activeConv.peer_id, activeConv.id)}>
                <UserAvatar username={activeConv.peer_username || activeConv.peer_name} className="size-9 shrink-0" />
                <span className="truncate text-sm font-medium">{convTitle(activeConv)}</span>
              </ProfileButton>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
              <DayDivider label={t('today')} />
              {thread.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  mine={m.mine}
                  grouped={thread[i - 1]?.mine === m.mine}
                  time={localTime(m.at, hourCycle)}
                  status={m.mine ? statusLabel(t, m.status) : undefined}
                  menu={{
                    label: t('messageStatus'),
                    items: [
                      ...(m.body ? [{ id: 'copy', label: t('copy'), onSelect: () => void navigator.clipboard.writeText(m.body).then(() => toast(t('copied'))) }] : []),
                      { id: 'status', label: t('messageStatus'), onSelect: () => setStatusFor(m) },
                    ],
                  }}
                >
                  <div className="space-y-2">
                    {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                    {m.files?.length ? (
                      <MessageAttachments
                        files={m.files}
                        expanded={openFiles.has(m.id)}
                        downloading={downloading}
                        onExpand={() => setOpenFiles((prev) => new Set(prev).add(m.id))}
                        onDownload={(file) => void saveFile(m, file)}
                        onView={(file) => void viewFile(m, file)}
                        fileMenu={(file) => [
                          { id: 'view', label: t('view'), onSelect: () => void viewFile(m, file) },
                          { id: 'download', label: t('download'), onSelect: () => void saveFile(m, file) },
                          { id: 'share', label: t('share'), onSelect: () => void shareFile(m, file) },
                        ]}
                      />
                    ) : null}
                  </div>
                </MessageBubble>
              ))}
              {typing?.conversationId === active && !prefs[active]?.muted ? <TypingIndicator name={typing.name || '…'} /> : null}
            </div>
            {transfer ? <div className="shrink-0 px-3 pb-2"><TransferProgress title={transfer.title} loaded={transfer.loaded} total={transfer.total} startedAt={transfer.startedAt} onCancel={stopTransfer} /></div> : null}
            <form
              className="flex shrink-0 flex-col gap-2 border-t border-line p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              {pending.length ? (
                <div className="flex max-w-full gap-1 overflow-x-auto">
                  {pending.map((file, index) => (
                    <span key={`${file.name}-${file.size}-${index}`} className="inline-flex max-w-36 shrink-0 items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs">
                      <span className="truncate">{file.name || 'file'}</span>
                      <button type="button" className="text-muted" aria-label={t('removeFile')} onClick={() => setPending((prev) => prev.filter((_, i) => i !== index))}>×</button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex min-w-0 items-end gap-2">
              <FileButton label={t('attachment')} onPick={attachFiles} />
              <Textarea
                className="max-h-32 min-h-11 flex-1"
                rows={1}
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
              <Button type="submit" className="shrink-0 whitespace-nowrap">{t('send')}</Button>
              </div>
            </form>
          </>
        ) : (
          <p className="p-6 text-sm text-muted">{t('pickConversation')}</p>
        )}
      </section>
    </div>
    {viewer ? <Lightbox src={viewer.src} alt={viewer.name} caption={viewer.name} fileName={viewer.name} kind={viewer.kind} onClose={() => setViewer(null)} onDownload={() => { if (!viewer.mine && viewer.via !== 'peer' && viewer.fileId) void api(`/v1/mailbox/files/${viewer.fileId}/ack`, { method: 'POST' }) }} /> : null}
    <Dialog open={!!statusMessage} onOpenChange={(open) => { if (!open) setStatusFor(null) }} title={t('messageStatus')}>
      {statusMessage ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>{t('statusSent')}</dt><dd>{stamp(statusMessage.at, hourCycle)}</dd></div>
          <div className="flex justify-between gap-4"><dt>{t('statusDelivered')}</dt><dd>{statusMessage.deliveredAt ? stamp(statusMessage.deliveredAt, hourCycle) : statusMessage.status === 'delivered' || statusMessage.status === 'read' ? t('statusDelivered') : t('pending')}</dd></div>
          <div className="flex justify-between gap-4"><dt>{t('statusRead')}</dt><dd>{statusMessage.readAt ? stamp(statusMessage.readAt, hourCycle) : statusMessage.status === 'read' ? t('statusRead') : t('pending')}</dd></div>
        </dl>
      ) : null}
    </Dialog>
    </>
  )
}

function shouldKeep(mime: string, size: number) {
  if (size > 80 * 1024 * 1024) return false
  if (mime.startsWith('image/') || mime.startsWith('text/') || mime.startsWith('audio/')) return true
  return size <= 20 * 1024 * 1024
}

async function attachCachedFiles(rows: LocalMessage[]) {
  const next: LocalMessage[] = []
  for (const row of rows) {
    if (!row.files?.length) {
      next.push(row)
      continue
    }
    const files = await Promise.all(row.files.map(async (file) => {
      if (file.url) return file
      const bytes = await readBytes(file.id)
      if (!bytes) return file
      return { ...file, url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: file.mime || 'application/octet-stream' })) }
    }))
    next.push({ ...row, files })
  }
  return next
}

function stamp(iso: string, cycle: '24' | '12') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: cycle === '24' ? 'h23' : 'h12' })
}

function lastAt(messages: { conversationId: string; at: string }[], conversationId: string) {
  let at = 0
  for (const message of messages) {
    if (message.conversationId !== conversationId) continue
    const time = Date.parse(message.at)
    if (time > at) at = time
  }
  return at
}

function localTime(iso: string, cycle: '24' | '12') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: cycle === '24' ? 'h23' : 'h12' })
}

function withoutUrls(message: LocalMessage): LocalMessage {
  return { ...message, files: message.files?.map(({ url: _url, ...file }) => file) }
}

function statusLabel(translate: (key: string) => string, status: string) {
  if (status === 'sending' || status === 'queued' || status === 'connecting') return translate('statusSending')
  if (status === 'sent' || status === 'stored' || status === 'mailboxing' || status === 'sending_p2p') return translate('statusSent')
  if (status === 'waiting_peer') return translate('waitingPeer')
  if (status === 'delivered') return translate('statusDelivered')
  if (status === 'read') return translate('statusRead')
  if (status === 'failed') return translate('statusFailed')
  if (status === 'expired') return translate('statusExpired')
  if (status === 'cancelled') return translate('cancelled')
  return status
}

function FileButton({ label, onPick }: { label: string; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onPick(files)
          e.target.value = ''
        }}
      />
      <IconButton label={label} type="button" className="shrink-0" onClick={() => input.current?.click()}>
        <ClipIcon />
      </IconButton>
    </>
  )
}

function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.9 8.76l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

