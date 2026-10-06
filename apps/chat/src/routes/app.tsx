import { ApiError, api, apiBlobProgress, apiUpload, authApi } from '@ma/api-client'
import { b64, pairingConfirm, ready, unb64 } from '@ma/crypto'
import { canonicalDisplayName, displayNameError, groupNameError, MAILBOX_MAX_FILE_BYTES, MAILBOX_USER_QUOTA_BYTES, newFrame, passwordError, plaintextMessageSchema, usernameError, vaultPasswordError } from '@ma/protocol'
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
  type FileAvailability,
  PresenceDot,
  SavedMessagesAvatar,
  TypingIndicator,
  SettingsRow,
  SettingsSection,
  SkyBackdrop,
  Switch,
  Textarea,
  TransferProgress,
  toast,
} from '@ma/ui'
import { Pin } from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { activeDatabase, openAccount } from '../lib/db'
import { ensureDeviceSecrets, friendlyDeviceName, publicDeviceKeys, rememberDeviceSecrets, takeDeviceSecrets } from '../lib/device'
import { blobParts, ciphertextSize, createEncryptor, decryptParts, FILE_CHUNK_BYTES, pullDecryptor, type FileCipherMeta } from '../lib/files'
import { replayOutbox } from '../lib/outbox'
import { dismissTransfer, loadPrefs, loadStorageGb, savePrefs as savePrefsStore, saveStorageGb, transferDismissed, type ChatPref } from '../lib/prefs'
import { enablePush, notifyHere, notifyPrefOn, setAppBadge, setNotifyPref } from '../lib/push'
import { openNamed, openWriter, opfsAvailable, removeNamed } from '../lib/opfs'
import { resetChatRuntime } from '../lib/runtime'
import { chunkMessages, exportHistory, storeHistory, type SyncMessage } from '../lib/sync'
import { useSession } from '../lib/session'
import { Transport, transport } from '../lib/transport'
import { AuthScreens } from '../features/auth/AuthScreens'
import { CreateGroup } from '../features/conversations/CreateGroup'
import { GroupInfo } from '../features/conversations/GroupInfo'
import { DeviceList } from '../features/devices/DeviceList'
import { formatBytes } from '../features/messages/format'
import { RecoveryKeyDialog, TotpDialog } from '../features/security/SecurityDialogs'
import { CloudQuotaDialog, cloudUsage, type CloudUsage } from '../features/storage/CloudQuota'
import { WipeLocalData } from '../features/storage/WipeLocalData'
import { TransferPrompt } from '../features/transfers/TransferPrompt'
import { UnlockScreen, VaultExplainer } from '../features/vault/UnlockScreen'
import {
  addRecoverySlot,
  beginCipherFile,
  changeVaultPassword,
  cleanOldFiles,
  createVault,
  disableWebAuthnUnlock,
  enableWebAuthnUnlock,
  enforceStorageLimit,
  forgetFile,
  getIdentity,
  hasVault,
  hasWebAuthnUnlock,
  importTransferredIdentity,
  isUnlocked,
  keepCipher,
  keepFile,
  loadHistory,
  lockVault,
  openStored,
  readBlob,
  reconcileFiles,
  sealRow,
  storageUsage,
  storedIds,
  unlockVault,
  unlockVaultWithWebAuthn,
  vaultOwner,
  webAuthnUnlockAvailable,
  touchVault,
  type StoredFile,
} from '../lib/vault'

type Me = { id: string; username: string; display_name: string; totp_enabled?: boolean }
type Contact = { id: string; username: string; display_name: string; state: string; x25519?: string }
type Member = { id: string; username: string; display_name: string; role: string; x25519?: string }
type Conversation = { id: string; kind?: string; title?: string; peer_id: string; peer_name: string; peer_username?: string; peer_x25519?: string; members?: Member[] }
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
  route?: 'direct' | 'server' | 'mixed'
  receipts?: { delivered?: { userId: string; at: string }[]; read?: { userId: string; at: string }[] }
}

/** Incoming P2P file: chunks are decrypted as they arrive and, when there is room, written straight to OPFS. */
type Pull = {
  fileId: string
  from: string
  name: string
  mime: string
  size: number
  meta: FileCipherMeta
  received: number
  parts: Uint8Array[]
  queue: Promise<void>
  decrypt: ((chunk: Uint8Array) => Uint8Array) | null
  sink: Awaited<ReturnType<typeof beginCipherFile>>
  failed: boolean
}

const PROBE_TTL = 30_000
/** A requested peer file that shows no start or chunk for this long is treated as stalled. */
const PULL_STALL_MS = 30_000
/** Tag bytes secretstream (XChaCha20-Poly1305) adds to every chunk. Fixed by libsodium. */
const SECRETSTREAM_ABYTES = 17
/** The server caps the ciphertext it receives, so compare the encrypted size against the cloud limit. */
function fitsCloud(size: number) {
  return size + Math.max(1, Math.ceil(size / FILE_CHUNK_BYTES)) * SECRETSTREAM_ABYTES <= MAILBOX_MAX_FILE_BYTES
}
/** How long a group file stays offerable after the last byte moved, so someone who was offline can still join the send. */
const SHARE_TAIL = 120_000

type LiveShare = {
  id: string
  conversationId: string
  at: string
  body: string
  senderId: string
  files: ChatFile[]
  offered: Set<string>
  keyed: Set<string>
  cloudReady: Set<string>
  sending: Set<string>
  until: number
}
const INLINE_PREVIEW_BYTES = 12 * 1024 * 1024

export function ChatApp() {
  const { t } = useTranslation('common')
  const session = useSession()
  const [mode, setMode] = useState<'login' | 'register' | '2fa' | 'app'>('login')
  const [challenge, setChallenge] = useState('')
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)
  const [webAuthnReady, setWebAuthnReady] = useState(false)
  const [webAuthnCapable, setWebAuthnCapable] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [fileRoute, setFileRoute] = useState<'auto' | 'direct' | 'server'>('auto')
  const [dragOver, setDragOver] = useState(false)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<string | null>(null)
  const [lookup, setLookup] = useState('')
  const [enterToSend, setEnterToSend] = useState(() => localStorage.getItem('ma.chat.enterToSend') !== '0')
  const [relay, setRelay] = useState(() => localStorage.getItem('ma.chat.relayOnly') === '1')
  const [directOnly, setDirectOnly] = useState(() => localStorage.getItem('ma.chat.directOnly') === '1')
  const [hideSenderNames, setHideSenderNames] = useState(() => {
    const hide = localStorage.getItem('ma.chat.hideSenderNames')
    if (hide === '1' || hide === '0') return hide === '1'
    const legacy = localStorage.getItem('ma.chat.showSenderNames')
    if (legacy === '1') return false
    if (legacy === '0') return true
    return false
  })
  const [hideNotifyBody, setHideNotifyBody] = useState(() => localStorage.getItem('ma.chat.hideNotifyBody') === '1')
  const [notifyOn, setNotifyOn] = useState(() => notifyPrefOn())
  const [transfer, setTransfer] = useState<{ title: string; loaded: number; total: number; startedAt: number; fileId: string; peerId: string; kind: 'upload' | 'send' | 'receive' } | null>(null)
  const [usage, setUsage] = useState({ chatBytes: 0, fileBytes: 0, queueBytes: 0, total: 0 })
  const [limitGb, setLimitGb] = useState(() => loadStorageGb(''))
  const [pairId, setPairId] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [pairQr, setPairQr] = useState('')
  const [pairFingerprint, setPairFingerprint] = useState('')
  const [askTransfer, setAskTransfer] = useState(false)
  const [identityOutOfSync, setIdentityOutOfSync] = useState(false)
  const [vaultDialog, setVaultDialog] = useState(false)
  const [currentVaultPassword, setCurrentVaultPassword] = useState('')
  const [nextVaultPassword, setNextVaultPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [totpOpen, setTotpOpen] = useState(false)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [groupInfoFor, setGroupInfoFor] = useState<string | null>(null)
  const [cloudPrompt, setCloudPrompt] = useState<{ usage: CloudUsage; need: number; canDirect: boolean } | null>(null)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [wsOnline, setWsOnline] = useState(false)
  const [typing, setTyping] = useState<{ conversationId: string; name: string } | null>(null)
  const [stored, setStored] = useState<Set<string>>(new Set())
  const [swarmTick, setSwarmTick] = useState(0)
  const typedAt = useRef(0)
  const outgoing = useRef(new Map<string, File>())
  const sessionFiles = useRef(new Map<string, Blob>())
  const holdersRef = useRef(new Map<string, Map<string, number>>())
  const missingRef = useRef(new Map<string, Set<string>>())
  const probeStamp = useRef(new Map<string, number>())
  const holderWaits = useRef(new Map<string, { pending: Set<string>; found: Map<string, number>; finish: () => void }>())
  const askOrder = useRef(new Map<string, string[]>())
  const messagesRef = useRef<LocalMessage[]>([])
  const transferAbort = useRef<AbortController | null>(null)
  const abortFile = useRef('')
  const transferLock = useRef<string | null>(null)
  /** Kind of the transfer currently owning the progress UI. */
  const transferKind = useRef<'upload' | 'send' | 'receive' | null>(null)
  /** Peer uploads in flight: file id → peer user ids. Lets several group members pull the same file at once. */
  const peerUploads = useRef(new Map<string, Set<string>>())
  const MAX_PEER_UPLOADS = 3
  const cancelledFiles = useRef(new Set<string>())
  const pull = useRef<Pull | null>(null)
  const probed = useRef(new Map<string, number>())
  const threadBox = useRef<HTMLDivElement>(null)
  const stickBottom = useRef(true)
  const fileApi = useRef({
    request: (_fileId: string, _userId: string) => {},
    probe: (_fileId: string, _userId: string) => {},
    missing: (_fileId: string, _userId: string) => {},
    have: (_fileId: string, _userId: string) => {},
    busy: (_fileId: string, _userId: string) => {},
  })
  const [hourCycle, setHourCycle] = useState<'24' | '12'>(() => (localStorage.getItem('ma.time') === '12' ? '12' : '24'))
  const [prefs, setPrefs] = useState<Record<string, ChatPref>>({})
  const tRef = useRef(t)
  tRef.current = t
  const [viewer, setViewer] = useState<{ src: string; name: string; kind: 'image' | 'video'; messageId: string; fileId: string; mine: boolean; via?: ChatFile['via'] } | null>(null)
  const [statusFor, setStatusFor] = useState<LocalMessage | null>(null)
  const wantView = useRef('')
  const wantSave = useRef('')
  const transferPassword = useRef('')
  const syncSnapshot = useRef<SyncMessage[]>([])
  const syncReady = useRef<Promise<void>>(Promise.resolve())
  const syncRef = useRef<() => void>(() => {})
  const replayRef = useRef<() => void>(() => {})
  const deviceSyncRef = useRef<() => void>(() => {})
  const publishSyncRef = useRef<(messages: SyncMessage[]) => void>(() => {})
  const meRef = useRef(session.user?.id)
  meRef.current = session.user?.id
  messagesRef.current = messages
  const onlineRef = useRef(online)
  onlineRef.current = online
  const onlineDevicesRef = useRef(new Map<string, string[]>())
  const notifyReady = useRef(false)
  const activeRef = useRef(active)
  activeRef.current = active
  const hideSenderNamesRef = useRef(hideSenderNames)
  hideSenderNamesRef.current = hideSenderNames
  const hideNotifyBodyRef = useRef(hideNotifyBody)
  hideNotifyBodyRef.current = hideNotifyBody
  const syncNotifyPref = () => {
    void navigator.serviceWorker?.controller?.postMessage({
      type: 'notify-pref',
      hideSender: hideSenderNamesRef.current,
      hideBody: hideNotifyBodyRef.current,
    })
  }
  const conversationsRef = useRef(conversations)
  conversationsRef.current = conversations
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const liveShares = useRef(new Map<string, LiveShare>())
  const busyRetry = useRef(new Map<string, number>())
  /** Set while send() is preparing files, so a double tap cannot start a second upload. */
  const sendingFiles = useRef(false)
  /** Watchdog for a peer file this device asked for: fires when nothing arrives for PULL_STALL_MS. */
  const pullWatch = useRef<{ fileId: string; last: number; timer: number } | null>(null)
  const offerLateRef = useRef<(userId: string) => void>(() => {})
  offerLateRef.current = (userId: string) => {
    for (const share of liveShares.current.values()) {
      if (!shareStillCurrent(share)) {
        liveShares.current.delete(share.id)
        continue
      }
      void offerShare(share, userId)
    }
  }

  function markStored(ids: string[], gone: string[] = []) {
    if (!ids.length && !gone.length) return
    setStored((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      for (const id of gone) next.delete(id)
      return next
    })
  }

  function dropMessages(ids: string[]) {
    if (!ids.length) return
    setMessages((prev) => prev.filter((message) => !ids.includes(message.id)))
  }

  async function refreshUsage() {
    setUsage(await storageUsage())
  }

  useEffect(() => {
    if (!unlocked) {
      notifyReady.current = false
      setMessages([])
      setStored(new Set())
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
      await reconcileFiles().catch(() => undefined)
      const attached = await attachCachedFiles(aged as LocalMessage[])
      setMessages(attached.messages)
      setStored(attached.kept)
      await refreshUsage()
    })
  }, [unlocked])

  async function adoptAccount(userId: string, me?: { totp_enabled?: boolean }) {
    await openAccount(userId)
    setPrefs(loadPrefs(userId))
    setLimitGb(loadStorageGb(userId))
    setVaultExists(await hasVault())
    setWebAuthnReady(await hasWebAuthnUnlock().catch(() => false))
    setWebAuthnCapable(await webAuthnUnlockAvailable().catch(() => false))
    if (me) setTotpEnabled(!!me.totp_enabled)
  }

  useEffect(() => {
    const refreshSession = () => {
      void authApi.session().then(async (row) => {
        if (!row.authenticated || !row.id || !row.username || !row.display_name) {
          resetChatRuntime()
          setUnlocked(false)
          setVaultExists(null)
          setMode('login')
          return
        }
        const me = {
          id: row.id,
          username: row.username,
          display_name: row.display_name,
          email: row.email,
          totp_enabled: row.totp_enabled,
          device_id: row.device_id,
          trust_state: row.trust_state,
        }
        const current = useSession.getState()
        if (current.user && current.user.id !== me.id) resetChatRuntime()
        useSession.getState().setSession(me, me.device_id || null, me.trust_state || null)
        if (me.id) await adoptAccount(me.id, me)
        if (me.trust_state === 'pending' && !isUnlocked() && me.id && !transferDismissed(me.id)) setAskTransfer(true)
        setMode('app')
      }).catch(() => {
        resetChatRuntime()
        setUnlocked(false)
        setVaultExists(null)
        setMode('login')
      })
    }
    refreshSession()
    window.addEventListener('ma-auth', refreshSession)
    return () => window.removeEventListener('ma-auth', refreshSession)
  }, [])

  useEffect(() => {
    const onLock = () => setUnlocked(false)
    window.addEventListener('ma-vault-lock', onLock)
    return () => window.removeEventListener('ma-vault-lock', onLock)
  }, [])

  useEffect(() => {
    if (!unlocked) return
    const bump = () => touchVault()
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
    for (const name of events) window.addEventListener(name, bump, { passive: true })
    return () => {
      for (const name of events) window.removeEventListener(name, bump)
    }
  }, [unlocked])

  useEffect(() => {
    if (mode !== 'app' || !unlocked) return
    transport.relayOnly = relay
    transport.directOnly = directOnly
    transport.setLocalUser(session.user?.id || '')
    transport.connect()
    let syncSoon: number | null = null
    const sync = () => {
      if (syncSoon != null) return
      syncSoon = window.setTimeout(() => {
        syncSoon = null
        syncRef.current()
      }, 250)
    }
    const off = transport.on((frame) => {
      if (frame.t === 'session.ready') {
        setWsOnline(true)
        deviceSyncRef.current()
        window.setTimeout(() => { notifyReady.current = true }, 1500)
        if (notifyPrefOn()) void enablePush().then((on) => setNotifyOn(on)).catch(() => undefined)
      }
      if (frame.t === 'session.closed') setWsOnline(false)
      if (frame.t === 'session.ready' || frame.t === 'mailbox.new' || frame.t === 'contacts.updated' || frame.t === 'conversations.updated') sync()
      if (frame.t === 'presence.snapshot') {
        const users = Array.isArray(frame.p.users) ? frame.p.users.map(String) : []
        const listed = frame.p.devices
        const nextDevices = new Map<string, string[]>()
        if (listed && typeof listed === 'object' && !Array.isArray(listed)) {
          for (const [id, ids] of Object.entries(listed as Record<string, unknown>)) {
            if (Array.isArray(ids)) nextDevices.set(id, ids.map(String).filter(Boolean))
          }
        }
        for (const id of users) if (!nextDevices.has(id)) nextDevices.set(id, [])
        onlineDevicesRef.current = nextDevices
        const next = new Set(users)
        onlineRef.current = next
        setOnline(next)
        probed.current.clear()
        for (const id of users) {
          transport.warmPeer(id, nextDevices.get(id) ?? [])
          offerLateRef.current(id)
        }
        replayRef.current()
      }
      if (frame.t === 'presence.update') {
        const id = String(frame.p.user ?? '')
        const next = new Set(onlineRef.current)
        const ids = Array.isArray(frame.p.devices) ? frame.p.devices.map(String).filter(Boolean) : []
        if (frame.p.online) {
          next.add(id)
          onlineDevicesRef.current.set(id, ids)
        } else {
          next.delete(id)
          onlineDevicesRef.current.delete(id)
        }
        onlineRef.current = next
        if (frame.p.online) {
          probed.current.clear()
          transport.warmPeer(id, ids)
          offerLateRef.current(id)
          replayRef.current()
        }
        setOnline(next)
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
        const from = frame.from?.user || ''
        setMessages((prev) => prev.map((m) => {
          if (!m.mine || !ids.includes(m.id)) return m
          const conv = conversationsRef.current.find((item) => item.id === m.conversationId)
          const group = conv?.kind === 'group'
          let next = m
          if (group && from && from !== meRef.current) {
            const delivered = [...(m.receipts?.delivered ?? [])]
            const read = [...(m.receipts?.read ?? [])]
            if (!delivered.some((row) => row.userId === from)) delivered.push({ userId: from, at: now })
            if (status === 'read' && !read.some((row) => row.userId === from)) read.push({ userId: from, at: now })
            const recipients = (conv?.members ?? []).filter((member) => member.id && member.id !== meRef.current).length
            const aggregate = read.length >= Math.max(1, recipients) ? 'read' : delivered.length ? (read.length ? 'read' : 'delivered') : m.status
            next = {
              ...m,
              status: m.status === 'read' ? 'read' : aggregate === 'read' || status === 'read' ? 'read' : aggregate === 'delivered' || status === 'delivered' ? 'delivered' : m.status,
              deliveredAt: m.deliveredAt || now,
              readAt: status === 'read' || read.length ? m.readAt || now : m.readAt,
              receipts: { delivered, read },
            }
          } else {
            if (m.status === 'read' || m.status === status) return m
            next = {
              ...m,
              status,
              deliveredAt: status === 'delivered' || status === 'read' ? m.deliveredAt || now : m.deliveredAt,
              readAt: status === 'read' ? m.readAt || now : m.readAt,
            }
          }
          if (next === m) return m
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
      if (frame.t === 'chat.envelope') {
        const raw = frame.p.envelope
        if (raw) {
          void ingestEnvelope(raw, frame.id).then((fresh) => {
            if (fresh) void refreshUsage()
          }).catch(() => undefined)
        }
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
            size?: number
            messages?: SyncMessage[]
            ids?: string[]
            source?: boolean
            final?: boolean
            alg?: string
            ciphertext?: string
          }
          // A text message sent over the data channel while both sides were online.
          if (parsed.alg && parsed.ciphertext) {
            void ingestEnvelope(parsed, crypto.randomUUID()).then((fresh) => {
              if (fresh) void refreshUsage()
            }).catch(() => undefined)
            return
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
              setVaultExists(true)
              setUnlocked(true)
            })()
          }
          if (parsed.t === 'sync.records' && Array.isArray(parsed.messages)) {
            const inbound = parsed.messages
            const fromSource = parsed.source
            const done = parsed.final
            const peer = frame.from
            void syncReady.current.then(() => storeHistory(inbound)).then(async (merged) => {
              const attached = await attachCachedFiles(merged as LocalMessage[])
              setMessages(attached.messages)
              setStored(attached.kept)
              await refreshUsage()
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
            beginPull({
              fileId: parsed.file_id,
              from: frame.from?.user || '',
              name: parsed.name || 'file',
              mime: parsed.mime || 'application/octet-stream',
              size: Number(parsed.size ?? 0) || 0,
              meta: { key: parsed.key, header: parsed.header, lengths: parsed.lengths },
            })
          }
          if (parsed.t === 'file.end' && parsed.file_id) void finishPull(parsed.file_id)
          if (parsed.t === 'file.abort' && parsed.file_id) void abortPull(parsed.file_id, true)
        } catch {
          // text envelopes are handled by mailbox and outbox paths
        }
      }
      if (frame.t === 'p2p.binary') {
        const bytes = frame.p.bytes
        if (bytes instanceof Uint8Array) pushPull(bytes)
      }
      if (frame.t === 'chat.file.request') fileApi.current.request(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.probe') fileApi.current.probe(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.have') fileApi.current.have(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.missing') fileApi.current.missing(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.busy') fileApi.current.busy(String(frame.p.file_id ?? ''), frame.from?.user ?? '')
      if (frame.t === 'chat.file.cancel') {
        const fileId = String(frame.p.file_id ?? '')
        const fromUser = frame.from?.user ?? ''
        // Say once why a download stopped when the peer we were pulling from (or had asked) ends it.
        const pulling = !!fileId && pull.current?.fileId === fileId && pull.current.from === fromUser
        const asked = !!fileId && pullWatch.current?.fileId === fileId && askOrder.current.get(fileId)?.[0] === fromUser
        if (fileId) cancelledFiles.current.add(fileId)
        if (pulling || asked) {
          clearPullWatch(fileId)
          toast(tRef.current(frame.p.reason === 'interrupted' ? 'transferInterrupted' : 'transferCancelledBySender'))
        }
        void abortPull(fileId, false)
        const activeTransfer = !fileId || transferLock.current === fileId || abortFile.current === fileId
        if (activeTransfer) {
          transferAbort.current?.abort()
          transferAbort.current = null
          abortFile.current = ''
          if (!fileId || transferLock.current === fileId) {
            transferLock.current = null
            transferKind.current = null
          }
          setDownloading(null)
          setTransfer(null)
        }
      }
    })
    sync()
    syncNotifyPref()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      sync()
      if (notifyPrefOn()) void enablePush().then((on) => setNotifyOn(on)).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(sync, 20000)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
      if (syncSoon != null) window.clearTimeout(syncSoon)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, unlocked, relay, directOnly, session.user?.id])

  async function refresh() {
    const [c, conv] = await Promise.all([
      api<Contact[]>('/v1/contacts'),
      api<Conversation[]>('/v1/conversations'),
    ])
    setContacts(c)
    conversationsRef.current = conv
    setConversations(conv)
    for (const id of onlineRef.current) offerLateRef.current(id)
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
        device: { name: friendlyDeviceName(), platform: navigator.platform, pk_ed25519: keys.ed25519, pk_x25519: keys.x25519 },
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
        await adoptAccount(res.user.id, res.user as Me)
        if (res.device?.trust_state === 'pending' && !transferDismissed(res.user.id)) setAskTransfer(true)
      }
      setMode('app')
    } catch (err) {
      toast(explain(err))
    }
  }

  async function onRegister(values: { username: string; password: string; display: string; invite: string }) {
    const nameError = usernameError(values.username)
    const displayError = values.display ? displayNameError(values.display) : displayNameError(values.username)
    const passError = passwordError(values.password)
    if (nameError || displayError || passError) {
      const message = nameError ? t('usernameInvalid') : displayError ? t('displayNameInvalid') : t('passwordInvalid')
      throw new Error(message)
    }
    try {
      await authApi.register({ invite_code: values.invite, username: values.username, password: values.password, display_name: canonicalDisplayName(values.display || values.username) })
      toast(t('accountCreated'))
      setMode('login')
    } catch (err) {
      const message = err instanceof ApiError && err.code === 'server_overloaded' ? t('registerOverloaded') : explain(err)
      throw new Error(message)
    }
  }

  async function on2fa(nextCode: string) {
    try {
      const res = await authApi.login2fa({ challenge_id: challenge, code: nextCode }) as { user: Me; device: { id: string; trust_state: string } }
      session.setSession(res.user, res.device.id, res.device.trust_state)
      if (res.user.id) {
        await adoptAccount(res.user.id, res.user)
        if (res.device.trust_state === 'pending' && !transferDismissed(res.user.id)) setAskTransfer(true)
      }
      setMode('app')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'challenge_expired') {
        toast(t('challengeExpired'))
        setMode('login')
        return
      }
      toast(err instanceof ApiError && err.code === 'invalid_code' ? t('codeWrong') : explain(err))
    }
  }

  const publishIdentityIfEmpty = useCallback(async (force = false, quiet = false) => {
    const pubs = { ed25519: getIdentity().identitySign.publicKey, x25519: getIdentity().identityBox.publicKey }
    if (!useSession.getState().user?.id) return
    let existing: { x25519: string } | null = null
    try {
      existing = await api<{ x25519: string }>('/v1/users/me/identity-keys')
    } catch (err) {
      const skip = err instanceof ApiError && (err.code === 'keys_missing' || err.code === 'not_found' || err.code === 'forbidden' || err.code === 'device_untrusted' || err.status === 404 || err.status === 403)
      if (!skip) throw err
    }
    if (!force && existing?.x25519 && existing.x25519 !== pubs.x25519) {
      setIdentityOutOfSync(true)
      if (!quiet) toast(t('identityMismatch'), { duration: 10_000 })
      return
    }
    if (!existing?.x25519 || existing.x25519 !== pubs.x25519) {
      await api('/v1/users/me/identity-keys', { method: 'PUT', body: JSON.stringify(pubs) })
    }
    setIdentityOutOfSync(false)
  }, [t])

  async function reclaimIdentityKey() {
    if (!window.confirm(t('useThisDeviceKeyConfirm'))) return
    try {
      await publishIdentityIfEmpty(true)
      toast(t('useThisDeviceKeyDone'))
    } catch (err) {
      toast(explain(err))
    }
  }

  const identityPublished = useRef(false)
  useEffect(() => {
    if (!unlocked) {
      identityPublished.current = false
      setIdentityOutOfSync(false)
      return
    }
    if (identityPublished.current) return
    identityPublished.current = true
    void publishIdentityIfEmpty(false, true).catch(() => undefined)
  }, [unlocked, publishIdentityIfEmpty])

  async function beginFresh(password: string) {
    const passError = vaultPasswordError(password)
    if (passError) {
      toast(passError)
      return
    }
    setAskTransfer(false)
    try {
      if (session.user?.id) await openAccount(session.user.id)
      const created = !(await hasVault())
      if (created) {
        await createVault(password)
        setVaultExists(true)
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
      }
      if (useSession.getState().trust === 'pending') {
        await api('/v1/devices/fresh', { method: 'POST' })
        const current = useSession.getState()
        current.setSession(current.user, current.deviceId, 'trusted')
      }
      await publishIdentityIfEmpty(created)
      setUnlocked(true)
      syncRef.current()
    } catch (err) {
      toast(explain(err))
    }
  }

  async function onUnlock(password: string) {
    if (useSession.getState().trust === 'pending') {
      await beginFresh(password)
      return
    }
    const passError = vaultPasswordError(password)
    if (passError) {
      toast(passError)
      return
    }
    try {
      if (session.user?.id) await openAccount(session.user.id)
      if (!(await hasVault())) {
        await createVault(password)
        setVaultExists(true)
        await publishIdentityIfEmpty()
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
      setWebAuthnReady(await hasWebAuthnUnlock().catch(() => false))
      setUnlocked(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'device_untrusted') {
        setAskTransfer(true)
        return
      }
      toast(explain(err))
    }
  }

  const onUnlockWebAuthn = useCallback(async (signal?: AbortSignal) => {
    try {
      if (session.user?.id) await openAccount(session.user.id)
      const owner = await vaultOwner()
      if (owner && session.user?.id && owner !== session.user.id) {
        toast(t('wrongVaultAccount'))
        throw new Error('vault_owner')
      }
      await unlockVaultWithWebAuthn(signal)
      await publishIdentityIfEmpty()
      setUnlocked(true)
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw err
      if (err instanceof ApiError && err.code === 'device_untrusted') {
        setAskTransfer(true)
        throw err
      }
      const code = err instanceof Error ? err.message : ''
      const name = err instanceof DOMException ? err.name : ''
      if (code === 'wrong_password' || code === 'no_webauthn') toast(t('webauthnFailed'))
      else if (code === 'webauthn_prf_unsupported') toast(t('webauthnPrfUnsupported'))
      else if (code === 'vault_owner') { /* toasted above */ }
      else if (code === 'webauthn_cancelled' || name === 'NotAllowedError' || name === 'AbortError' || /cancel|abort|denied permission|not allowed by the user agent/i.test(code)) {
        /* user cancelled — UnlockScreen shows the localized message */
      }
      else toast(explain(err))
      throw err
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user?.id, t])

  /** Decrypt one text envelope (from the mailbox or straight off a data channel), store it, and confirm delivery. */
  async function ingestEnvelope(raw: unknown, fallbackId: string) {
    const decoded = transport.decryptEnvelope(raw as Parameters<typeof transport.decryptEnvelope>[0])
    const parsed = plaintextMessageSchema.safeParse(JSON.parse(decoded))
    if (!parsed.success) return false
    const senderId = parsed.data.sender_id
    const files: ChatFile[] = parsed.data.attachments.map((file) => ({
      id: file.file_id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      key: file.key,
      header: file.header,
      lengths: file.lengths,
      via: file.key ? 'mailbox' : 'peer',
    }))
    const message: LocalMessage = {
      id: parsed.data.message_id || fallbackId,
      conversationId: parsed.data.conversation_id,
      body: parsed.data.body,
      mine: !!senderId && senderId === meRef.current,
      at: parsed.data.sent_at,
      status: 'delivered',
      deliveredAt: parsed.data.sent_at,
      senderId,
      files,
    }
    const fresh = !messagesRef.current.some((m) => m.id === message.id) && !(await activeDatabase().records.get(message.id))
    if (fresh) {
      messagesRef.current = [...messagesRef.current, message]
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      await sealRow('records', message.id, 'messages', withoutUrls(message))
      if (!message.mine && notifyReady.current && notifyPrefOn()) {
        const conv = conversationsRef.current.find((item) => item.id === message.conversationId)
        if (!conv || !prefsRef.current[conv.id]?.muted) {
          const watching = activeRef.current === message.conversationId && !document.hidden && document.hasFocus()
          if (!watching) {
            const sender = memberName(conv, senderId) || t('notifyNewMessage')
            const textPreview = message.body.trim() || (files.length ? t('notifyAttachment') : t('notifyOpenChat'))
            const group = conv?.kind === 'group' ? convTitle(conv) : ''
            // One-line title works on iOS (which inserts "from Chat" under the title). Desktop still gets title + body.
            const line = hideNotifyBodyRef.current
              ? (group || (hideSenderNamesRef.current ? t('notifyNewMessage') : sender))
              : hideSenderNamesRef.current
                ? (group ? `${group}: ${textPreview}` : textPreview)
                : group
                  ? `${group} · ${sender}: ${textPreview}`
                  : `${sender}: ${textPreview}`
            // Single-line alert: iOS would otherwise show "name / from Chat / message".
            notifyHere(line, '', message.conversationId, true)
          }
        }
      }
      const conv = conversationsRef.current.find((item) => item.id === message.conversationId)
      if (conv?.kind === 'group' && files.length) {
        const mineId = meRef.current
        liveShares.current.set(message.id, {
          id: message.id,
          conversationId: message.conversationId,
          at: message.at,
          body: message.body,
          senderId: senderId || '',
          files,
          offered: new Set([mineId, senderId].filter((item): item is string => !!item)),
          keyed: new Set(files.some((file) => file.key) && mineId ? [mineId] : []),
          cloudReady: new Set(files.filter((file) => file.key).map((file) => file.id)),
          sending: new Set(),
          until: Date.now() + SHARE_TAIL,
        })
      }
    } else {
      await mergeOffer(message)
    }
    if (senderId && senderId !== meRef.current) transport.sendFrame(newFrame('chat.delivered', { message_ids: [message.id] }, { user: senderId }))
    return fresh
  }

  /** A later offer can add a file the first envelope skipped, or attach the cloud key once the server copy exists. */
  async function mergeOffer(incoming: LocalMessage) {
    const current = messagesRef.current.find((item) => item.id === incoming.id)
    if (!current) return
    const prevFiles = current.files ?? []
    const nextFiles = prevFiles.map((file) => {
      const extra = incoming.files?.find((item) => item.id === file.id)
      if (extra?.key && !file.key) return { ...file, key: extra.key, header: extra.header, lengths: extra.lengths, via: 'mailbox' as const }
      return file
    })
    for (const extra of incoming.files ?? []) {
      if (!nextFiles.some((file) => file.id === extra.id)) nextFiles.push(extra)
    }
    const changed = nextFiles.length !== prevFiles.length || nextFiles.some((file, index) => file.key !== prevFiles[index]?.key || file.via !== prevFiles[index]?.via)
    if (!changed) return
    const next = { ...current, body: current.body || incoming.body, files: nextFiles }
    messagesRef.current = messagesRef.current.map((item) => (item.id === next.id ? next : item))
    setMessages((prev) => prev.map((item) => (item.id === next.id ? next : item)))
    await sealRow('records', next.id, 'messages', withoutUrls(next))
  }

  async function drainMailbox() {
    const items = await api<{ id: string; envelope: string }[]>('/v1/mailbox/messages')
    let failed = 0
    for (const item of items) {
      try {
        const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(item.envelope), (c) => c.charCodeAt(0))))
        await ingestEnvelope(raw, item.id)
        await api(`/v1/mailbox/messages/${item.id}/ack`, { method: 'POST' })
      } catch {
        failed += 1
        // Drop poison envelopes so they do not block the mailbox forever.
        await api(`/v1/mailbox/messages/${item.id}/ack`, { method: 'POST' }).catch(() => undefined)
      }
    }
    if (failed) toast(tRef.current('mailboxSomeSkipped', { count: failed }))
  }

  function noteDelivered(sent: { id: string; route: 'direct' | 'server' }[]) {
    if (!sent.length) return
    setMessages((prev) => prev.map((m) => {
      const hit = sent.find((item) => item.id === m.id)
      if (!hit || (m.status !== 'waiting_peer' && m.status !== 'sending' && m.status !== 'failed')) return m
      const next = { ...m, status: 'sent', route: hit.route }
      void sealRow('records', m.id, 'messages', withoutUrls(next))
      publishSyncRef.current([withoutUrls(next)])
      return next
    }))
  }

  syncRef.current = () => {
    if (useSession.getState().trust === 'pending') return
    void refresh().catch((err) => {
      if (err instanceof ApiError && (err.code === 'unauthorized' || err.status === 401)) {
        toast(tRef.current('sessionExpired'))
        resetChatRuntime()
        setUnlocked(false)
        setMode('login')
        return
      }
      if (err instanceof ApiError && err.code === 'network') toast(tRef.current('networkError'))
    })
    void drainMailbox().catch((err) => {
      if (err instanceof ApiError && err.code === 'network') toast(tRef.current('networkError'))
    })
    void replayOutbox().then(noteDelivered).catch(() => undefined)
  }
  replayRef.current = () => {
    void replayOutbox().then(noteDelivered).catch(() => undefined)
  }

  const me = session.user?.id

  /** Everyone in the conversation except us. One entry for direct chats, up to 19 for groups. */
  function recipientsOf(conv: Conversation) {
    if (conv.kind === 'group') return (conv.members ?? []).map((member) => member.id).filter((id) => id && id !== me)
    return [conv.peer_id]
  }

  async function recipientBoxKey(userId: string, conv?: Conversation) {
    if (userId === me) return getIdentity().identityBox.publicKey
    const known = conv?.members?.find((member) => member.id === userId)?.x25519
      || (conv?.peer_id === userId ? conv.peer_x25519 : undefined)
      || contacts.find((person) => person.id === userId)?.x25519
    if (known) return known
    return (await api<{ x25519: string }>(`/v1/contacts/${userId}/keys`)).x25519
  }

  function memberName(conv: Conversation | undefined, userId: string | undefined) {
    if (!userId) return ''
    if (userId === me) return t('you')
    const member = conv?.members?.find((item) => item.id === userId)
    if (member) return member.display_name || member.username
    const contact = contacts.find((item) => item.id === userId)
    if (contact) return contact.display_name || contact.username
    if (conv && conv.peer_id === userId) return conv.peer_name || conv.peer_username || ''
    return ''
  }

  function notifyTyping(conv: Conversation) {
    const now = Date.now()
    if (now - typedAt.current < 1500) return
    typedAt.current = now
    const name = session.user?.display_name || session.user?.username || ''
    for (const userId of recipientsOf(conv)) {
      if (userId === me) continue
      transport.sendFrame(newFrame('chat.typing', { conversation_id: conv.id, name }, { user: userId }))
    }
  }

  /** Hand a group file that is still being sent to a member who just came online. */
  async function offerShare(share: LiveShare, userId: string) {
    const meId = meRef.current
    if (!userId || userId === meId) return
    if (!shareStillCurrent(share)) {
      liveShares.current.delete(share.id)
      return
    }
    const conv = conversationsRef.current.find((item) => item.id === share.conversationId)
    if (conv?.kind !== 'group' || !(conv.members ?? []).some((member) => member.id === userId)) return
    const upgrade = !share.keyed.has(userId) && share.files.some((file) => file.key && share.cloudReady.has(file.id) && share.senderId === meId)
    if ((share.offered.has(userId) && !upgrade) || share.sending.has(userId)) return
    share.sending.add(userId)
    try {
      const attachments: { file_id: string; name: string; mime: string; size: number; key?: string; header?: string; lengths?: number[] }[] = []
      let sentKey = false
      for (const file of share.files) {
        const held = !!(await sourceFor(file.id))
        const cloud = !!(file.key && share.cloudReady.has(file.id) && share.senderId === meId)
        const linked = cloud && await api(`/v1/mailbox/files/${file.id}/recipients`, { method: 'POST', body: JSON.stringify({ recipient_user_id: userId }) }).then(() => true).catch(() => false)
        if (!held && !linked) continue
        if (linked) sentKey = true
        attachments.push({
          file_id: file.id,
          name: file.name,
          mime: file.mime,
          size: file.size,
          ...(linked ? { key: file.key, header: file.header, lengths: file.lengths } : {}),
        })
      }
      if (!attachments.length) return
      const payload = JSON.stringify({
        message_id: share.id,
        conversation_id: share.conversationId,
        sent_at: share.at,
        kind: 'file_offer',
        body: share.body,
        sender_id: share.senderId,
        attachments,
      })
      const recipientKeys = { x25519: await recipientBoxKey(userId, conv) }
      let deviceIds = onlineDevicesRef.current.get(userId) ?? []
      if (!deviceIds.length) {
        const devices = await api<{ id: string }[]>(`/v1/contacts/${userId}/devices`).catch(() => [])
        deviceIds = devices.map((item) => item.id)
      }
      await transport.deliverText({
        id: crypto.randomUUID(),
        conversationId: share.conversationId,
        recipientUserId: userId,
        state: 'queued',
        envelope: payload,
        size: payload.length,
        attempts: 0,
      }, recipientKeys.x25519, deviceIds[0] || '', deviceIds, onlineRef.current.has(userId))
      share.offered.add(userId)
      if (sentKey) share.keyed.add(userId)
      share.until = Date.now() + SHARE_TAIL
    } catch {
      // The next time they are seen online, the offer is tried again.
    } finally {
      share.sending.delete(userId)
    }
  }

  /** A quiet upload can outlast the tail. Keep the offer while this device is still sending or receiving it, or the message has not been posted yet. */
  function shareStillCurrent(share: LiveShare) {
    const moving = share.files.some((file) => {
      if (transferLock.current === file.id || pull.current?.fileId === file.id) return true
      return (peerUploads.current.get(file.id)?.size ?? 0) > 0
    })
    const posting = !messagesRef.current.some((message) => message.id === share.id) && share.files.some((file) => outgoing.current.has(file.id))
    if (moving || posting) {
      share.until = Date.now() + SHARE_TAIL
      return true
    }
    return share.until >= Date.now()
  }

  function announceNewcomers(messageId: string, started: Set<string>) {
    const share = liveShares.current.get(messageId)
    if (!share) return
    share.until = Date.now() + SHARE_TAIL
    for (const userId of onlineRef.current) {
      if (started.has(userId)) continue
      void offerShare(share, userId)
    }
  }

  function announceHolders(fileId: string) {
    for (const share of liveShares.current.values()) {
      if (!share.files.some((file) => file.id === fileId)) continue
      share.until = Date.now() + SHARE_TAIL
      for (const userId of onlineRef.current) void offerShare(share, userId)
    }
  }

  /** Tell online peers in every chat that holds this file that we can serve it. */
  function announceFileHave(fileId: string) {
    const peers = new Set<string>()
    for (const message of messagesRef.current) {
      if (!message.files?.some((file) => file.id === fileId)) continue
      for (const userId of onlinePeers(message.conversationId, message.senderId)) peers.add(userId)
    }
    for (const userId of peers) {
      transport.sendFrame(newFrame('chat.file.have', { file_id: fileId }, { user: userId }))
    }
    announceHolders(fileId)
    noteHave(fileId, meRef.current || '')
  }

  function peerUploadCount() {
    let total = 0
    for (const set of peerUploads.current.values()) total += set.size
    return total
  }

  function beginPeerUpload(fileId: string, userId: string) {
    if (pull.current?.fileId === fileId) return false
    const existing = peerUploads.current.get(fileId)
    if (existing?.has(userId)) return false
    if (peerUploadCount() >= MAX_PEER_UPLOADS) return false
    const set = existing ?? new Set<string>()
    set.add(userId)
    peerUploads.current.set(fileId, set)
    return true
  }

  function endPeerUpload(fileId: string, userId: string) {
    const set = peerUploads.current.get(fileId)
    if (!set) return
    set.delete(userId)
    if (!set.size) peerUploads.current.delete(fileId)
  }

  async function send(sendMode: 'auto' | 'direct' | 'server' = 'auto') {
    transport.directOnly = directOnly
    if (directOnly) sendMode = 'direct'
    else if (sendMode === 'auto' && fileRoute !== 'auto') sendMode = fileRoute
    const conv = conversations.find((c) => c.id === active)
    const text = draft.trim()
    const picked = pending
    if (!conv || (!text && picked.length === 0)) return
    if (picked.length && (transferLock.current || sendingFiles.current)) {
      toast(t('transferBusy'))
      return
    }
    if (picked.length) sendingFiles.current = true
    const id = crypto.randomUUID()
    const at = new Date().toISOString()
    setDraft('')
    setPending([])
    const files: ChatFile[] = []
    let activeFile = ''
    let allowDirect = false
    let postedLocal = false
    /** Sync-temp copies still on disk, and durable copies made for this send. */
    const stagedCleanup: (() => Promise<void>)[] = []
    const stagedDurable: string[] = []
    try {
      await ready()
      const recipients = recipientsOf(conv)
      const isSelf = conv.peer_id === me && conv.kind !== 'group'
      // People who are offline get one shared cloud copy. Everyone online gets the file directly.
      const presence = onlineRef.current
      const offline = isSelf ? [] : recipients.filter((userId) => userId !== me && !presence.has(userId))
      const onlineRecipients = isSelf ? [] : recipients.filter((userId) => userId !== me && presence.has(userId))
      const startedOnline = new Set(presence)
      allowDirect = onlineRecipients.length > 0
      const cloudTargets = sendMode === 'server'
        ? (isSelf ? [] : recipients.filter((userId) => userId !== me))
        : sendMode === 'direct'
          ? []
          : offline
      const oversized = picked.some((file) => !fitsCloud(file.size))
      const cloudBytes = !cloudTargets.length ? 0 : picked.reduce((sum, file) => fitsCloud(file.size) ? sum + ciphertextSize(file.size) : sum, 0)
      if (cloudBytes > 0) {
        const usage = cloudUsage(await api<CloudUsage>('/v1/mailbox/cloud').catch(() => null))
        if (usage && usage.used + cloudBytes > usage.limit) {
          setDraft(text)
          setPending(picked)
          setCloudPrompt({ usage, need: cloudBytes, canDirect: onlineRecipients.length > 0 })
          return
        }
      }
      if (cloudTargets.length && oversized) {
        const onlyOversized = !text && picked.every((file) => !fitsCloud(file.size))
        if (!onlineRecipients.length && onlyOversized) {
          setDraft(text)
          setPending(picked)
          toast(t('cloudNobodyOnline', { limit: formatBytes(MAILBOX_MAX_FILE_BYTES) }))
          return
        }
        toast(onlineRecipients.length ? t('cloudDirectOnly', { limit: formatBytes(MAILBOX_MAX_FILE_BYTES) }) : t('cloudNobodyOnline', { limit: formatBytes(MAILBOX_MAX_FILE_BYTES) }))
      }
      const cloudRecipients = new Map<string, Set<string>>()
      const directIds = new Set<string>()
      if (conv.kind === 'group' && picked.length) {
        liveShares.current.set(id, {
          id,
          conversationId: conv.id,
          at,
          body: text,
          senderId: me || '',
          files,
          offered: new Set(me ? [me] : []),
          keyed: new Set(),
          cloudReady: new Set(),
          sending: new Set(),
          until: Date.now() + SHARE_TAIL,
        })
      }
      for (const file of picked) {
        const fileId = crypto.randomUUID()
        const name = file.name || 'file'
        const mime = file.type || 'application/octet-stream'
        if (!fitsCloud(file.size) && !onlineRecipients.length && cloudTargets.length) continue
        const url = URL.createObjectURL(file)
        const queue = cloudTargets.length > 0 && fitsCloud(file.size)
        if (!queue) directIds.add(fileId)
        outgoing.current.set(fileId, file)
        sessionFiles.current.set(fileId, file)
        if (!queue) {
          void keepFile(fileId, file).then(({ kept, removed }) => {
            if (kept) markStored([fileId])
            dropMessages(removed)
            void refreshUsage()
          })
          files.push({ id: fileId, name, mime, size: file.size, via: 'peer', url })
          announceNewcomers(id, startedOnline)
          continue
        }
        const entry: ChatFile = { id: fileId, name, mime, size: file.size, via: 'peer', url }
        files.push(entry)
        transferLock.current = fileId
        transferKind.current = 'upload'
        activeFile = fileId
        const upload = new AbortController()
        transferAbort.current = upload
        abortFile.current = fileId
        const prepareTotal = ciphertextSize(file.size)
        const prepareTitle = t('preparingFile')
        setTransfer({
          title: prepareTitle,
          loaded: 0,
          total: prepareTotal,
          fileId,
          peerId: cloudTargets[0] || '',
          kind: 'upload',
          startedAt: Date.now(),
        })
        const stopped = () => upload.signal.aborted || cancelledFiles.current.has(fileId)
        let shownAt = 0
        const staged = await stageCipher(fileId, file, session.user?.id || '', {
          cancelled: stopped,
          onProgress: (done) => {
            const now = performance.now()
            if (now - shownAt < 120 && done < prepareTotal) return
            shownAt = now
            setTransfer((cur) => (cur?.fileId === fileId && cur.kind === 'upload' && cur.title === prepareTitle ? { ...cur, loaded: Math.min(done, cur.total || done) } : cur))
          },
        })
        const cleanupStaged = async () => {
          const run = staged.cleanup
          staged.cleanup = undefined
          await run?.().catch(() => undefined)
        }
        stagedCleanup.push(cleanupStaged)
        if (staged.stored) stagedDurable.push(fileId)
        if (stopped()) throw new DOMException('aborted', 'AbortError')
        if (staged.removed.length) dropMessages(staged.removed)
        if (staged.stored) {
          markStored([fileId])
          void refreshUsage()
        }
        const form = new FormData()
        form.set('file', staged.body, `${fileId}.bin`)
        form.set('conversation_id', conv.id)
        form.set('file_id', fileId)
        form.set('envelope', b64(new TextEncoder().encode(JSON.stringify({ alg: 'secretstream', name, mime, size: file.size, ...staged.meta }))))
        for (const recipientId of cloudTargets) form.append('recipient_user_id', recipientId)
        const uploadTotal = staged.body.size || prepareTotal
        // Fresh start time, so the upload speed is not diluted by the time spent encrypting.
        bumpTransfer('upload', 0, uploadTotal, fileId, cloudTargets[0] || '', true)
        await apiUpload('/v1/mailbox/files', form, (loaded, total) => {
          if (upload.signal.aborted || cancelledFiles.current.has(fileId)) return
          bumpTransfer('upload', loaded, total || uploadTotal, fileId, cloudTargets[0] || '')
        }, upload.signal, uploadTotal)
        await cleanupStaged()
        cloudRecipients.set(fileId, new Set(cloudTargets))
        Object.assign(entry, { via: 'mailbox' as const, ...staged.meta })
        liveShares.current.get(id)?.cloudReady.add(fileId)
        announceNewcomers(id, startedOnline)
      }
      const message: LocalMessage = { id, conversationId: conv.id, body: text, mine: true, at, status: 'sending', senderId: me, files }
      setMessages((prev) => [...prev, message])
      postedLocal = true
      const routes = new Set<'direct' | 'server'>()
      let missedDirect = false
      for (const recipientId of recipients) {
        const live = onlineRef.current
        const visible = files.filter((file) => !directIds.has(file.id) || live.has(recipientId) || recipientId === me)
        if (!text && !visible.length) continue
        const share = liveShares.current.get(id)
        const withKeys = visible.some((file) => cloudRecipients.get(file.id)?.has(recipientId))
        if (share?.offered.has(recipientId) && (!withKeys || share.keyed.has(recipientId))) continue
        const payload = JSON.stringify({
          message_id: id,
          conversation_id: conv.id,
          sent_at: at,
          kind: visible.length ? 'file_offer' : 'text',
          body: text,
          sender_id: me,
          attachments: visible.map((file) => {
            const onCloud = cloudRecipients.get(file.id)?.has(recipientId)
            return { file_id: file.id, name: file.name, mime: file.mime, size: file.size, ...(onCloud ? { key: file.key, header: file.header, lengths: file.lengths } : {}) }
          }),
        })
        const recipientKey = await recipientBoxKey(recipientId, conv)
        let deviceIds = onlineDevicesRef.current.get(recipientId) ?? []
        if ((live.has(recipientId) || recipientId === me) && !deviceIds.length) {
          const devices = await api<{ id: string; x25519: string }[]>(`/v1/contacts/${recipientId}/devices`).catch(() => [])
          deviceIds = devices.map((item) => item.id)
        }
        const delivery = { id, conversationId: conv.id, recipientUserId: recipientId, state: 'queued' as const, envelope: payload, size: payload.length, attempts: 0 }
        try {
          routes.add(await transport.deliverText(delivery, recipientKey, deviceIds[0] || '', deviceIds, live.has(recipientId) || recipientId === me))
        } catch (err) {
          if (err instanceof Error && err.message === 'direct_only') {
            missedDirect = true
            continue
          }
          throw err
        }
        const omitted = share?.files.some((file) => !visible.some((item) => item.id === file.id))
        if (!omitted) {
          share?.offered.add(recipientId)
          if (withKeys) share?.keyed.add(recipientId)
        }
        if (share) share.until = Date.now() + SHARE_TAIL
      }
      const route: LocalMessage['route'] = routes.has('direct') && routes.has('server') ? 'mixed' : routes.has('server') ? 'server' : routes.has('direct') || missedDirect ? 'direct' : undefined
      const status = routes.size === 0 && missedDirect ? 'waiting_peer' : 'sent'
      if (missedDirect) toast(t('peerOfflineDirect'))
      setMessages((prev) => prev.map((m) => {
        if (m.id !== id) return m
        if (m.status !== 'sending' && m.status !== 'failed') return m
        const sent = { ...m, status, route }
        void sealRow('records', id, 'messages', withoutUrls(sent))
        publishSyncRef.current([withoutUrls(sent)])
        return sent
      }))
      const finished = activeFile
      window.setTimeout(() => {
        setTransfer((cur) => (cur?.fileId === finished ? null : cur))
        releaseTransfer(finished)
      }, 600)
    } catch (err) {
      releaseTransfer(activeFile)
      setTransfer((cur) => (cur?.fileId === activeFile ? null : cur))
      // The sync-temp ciphertext is only for the upload; never leave it behind on failure.
      for (const run of stagedCleanup) await run()
      const posted = postedLocal || messagesRef.current.some((message) => message.id === id)
      if (!posted) {
        setDraft(text)
        setPending(picked)
        liveShares.current.delete(id)
        for (const file of files) {
          outgoing.current.delete(file.id)
          sessionFiles.current.delete(file.id)
          if (file.key) void api(`/v1/mailbox/cloud/${file.id}`, { method: 'DELETE' }).catch(() => undefined)
        }
        if (stagedDurable.length) {
          // Durable copies for a send that never happened would sit in storage with no message.
          markStored([], stagedDurable)
          void Promise.all(stagedDurable.map((fileId) => forgetFile(fileId).catch(() => undefined))).then(() => refreshUsage())
        }
      }
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.message === 'stage') {
        toast(t('cloudStageFailed'))
        return
      }
      const usage = err instanceof ApiError && err.code === 'quota_user' ? cloudUsage(err.details) : null
      if (usage) {
        setCloudPrompt({ usage, need: picked.reduce((sum, file) => sum + ciphertextSize(file.size), 0), canDirect: allowDirect })
        return
      }
      if (posted) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)))
      toast(explainTransfer(err))
    } finally {
      if (picked.length) sendingFiles.current = false
    }
  }

  function peerLabel(peerId: string) {
    if (!peerId || peerId === me) return t('savedMessages')
    const conv = conversations.find((c) => c.peer_id === peerId && c.kind !== 'group')
    const contact = contacts.find((c) => c.id === peerId)
    return conv?.peer_name || contact?.display_name || conv?.peer_username || contact?.username || ''
  }

  function transferTitle(kind: 'upload' | 'send' | 'receive', peerId: string) {
    if (kind === 'upload') return t('uploadingToServer')
    if (kind === 'receive') return t('received')
    const name = peerLabel(peerId)
    return name ? t('receiverReceived', { name }) : t('transferringFile')
  }

  function transferTracked(fileId: string) {
    if (cancelledFiles.current.has(fileId)) return false
    if (transferLock.current === fileId) return true
    if (pull.current?.fileId === fileId) return true
    return (peerUploads.current.get(fileId)?.size ?? 0) > 0
  }

  function claimTransfer(fileId: string) {
    if (transferLock.current && transferLock.current !== fileId) return false
    // Keep server-upload progress; peer serves can run without stealing the bar.
    if (transferLock.current === fileId && transferKind.current === 'upload') return false
    transferLock.current = fileId
    return true
  }

  function releaseTransfer(fileId: string) {
    if (transferLock.current === fileId) {
      transferLock.current = null
      transferKind.current = null
    }
  }

  function bumpTransfer(kind: 'upload' | 'send' | 'receive', loaded: number, total: number, fileId: string, peerId: string, reset = false) {
    for (const share of liveShares.current.values()) {
      if (share.files.some((file) => file.id === fileId)) share.until = Date.now() + SHARE_TAIL
    }
    if (!transferTracked(fileId) && transferLock.current !== fileId) return
    if (cancelledFiles.current.has(fileId)) return
    if (!transferLock.current) transferLock.current = fileId
    if (transferLock.current !== fileId) return
    // Peer/receive updates must not reset an in-flight server upload bar.
    if (transferKind.current === 'upload' && kind !== 'upload') return
    transferKind.current = kind
    const title = transferTitle(kind, peerId)
    setTransfer((prev) => {
      if (cancelledFiles.current.has(fileId) || transferLock.current !== fileId) return prev?.fileId === fileId ? null : prev
      // `reset` marks a fresh (re)start: let the bar drop back and restart the speed clock.
      const same = !reset && prev?.fileId === fileId && prev.kind === kind
      const nextLoaded = same && loaded < prev.loaded ? prev.loaded : loaded
      const nextTotal = same && total > 0 && prev.total > total ? prev.total : total
      return { title, loaded: nextLoaded, total: nextTotal, fileId, peerId, kind, startedAt: same ? prev.startedAt : Date.now() }
    })
  }

  function stopTransfer() {
    const current = transfer
    const fileId = current?.fileId ?? ''
    if (fileId) cancelledFiles.current.add(fileId)
    clearPullWatch(fileId)
    releaseTransfer(fileId)
    abortFile.current = ''
    transferAbort.current?.abort()
    transferAbort.current = null
    void abortPull(fileId, false)
    if (current?.peerId && fileId) transport.sendFrame(newFrame('chat.file.cancel', { file_id: fileId }, { user: current.peerId }))
    setDownloading(null)
    setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
  }

  function explain(err: unknown) {
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return t('webauthnCancelled')
    if (err instanceof ApiError) {
      if (err.code === 'server_overloaded') return t('serverOverloaded')
      if (err.code === 'keys_missing') return t('recipientNoVault')
      if ((err.code === 'not_found' || err.status === 404) && /file/i.test(err.message)) return t('fileNotOnServer')
      if (err.code === 'not_found' || err.status === 404) return t('couldNotSend')
      if (err.code === 'too_large') return t('fileTooLarge')
      if (err.code === 'rate_limited') return t('tooManyRequests')
      if (err.code === 'device_untrusted') return t('deviceUntrusted')
      if (err.code === 'unauthorized') return t('sessionExpired')
      if (err.code === 'invalid_credentials') return t('invalidCredentials')
      if (err.code === 'invite_invalid') return t('inviteInvalid')
      if (err.code === 'username_taken') return t('usernameTaken')
      if (err.code === 'group_full') return t('groupFull')
      if (err.code === 'not_contact') return t('groupNotContact')
      if (err.code === 'forbidden') return t('notAllowed')
      if (err.code === 'network') return t('networkError')
      if (err.code === 'timeout') return t('transferStalled')
      if (err.code === 'upload_incomplete') return t('transferInterrupted')
      if (err.code === 'http_error') return t('requestFailedStatus', { status: err.status || '?' })
    }
    if (err instanceof Error) {
      if (err.message === 'webauthn_cancelled' || err.name === 'NotAllowedError') return t('webauthnCancelled')
      if (/not allowed by the user agent|denied permission|timed out or was not allowed/i.test(err.message)) return t('webauthnCancelled')
      if (err.message === 'webauthn_unavailable') return t('webauthnUnavailable')
      if (err.message === 'webauthn_prf_unsupported') return t('webauthnPrfUnsupported')
      if (err.message === 'no_webauthn' || err.message === 'wrong_password') return t('webauthnFailed')
    }
    return err instanceof Error && err.message ? err.message : t('couldNotSend')
  }

  /** Like explain, but for file transfers: an abort here is a cancel, not a dismissed passkey prompt. */
  function explainTransfer(err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return t('cancelled')
    return explain(err)
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    const username = lookup.trim().replace(/^@/, '')
    if (!username) return
    try {
      await api('/v1/contacts', { method: 'POST', body: JSON.stringify({ username }) })
      setLookup('')
      await refresh()
    } catch (err) {
      toast(err instanceof ApiError && (err.status === 404 || err.code === 'not_found') ? t('userNotFound') : explain(err))
    }
  }

  async function openDirect(userId: string, name: string) {
    try {
      const conv = await api<Conversation>('/v1/conversations', { method: 'POST', body: JSON.stringify({ kind: 'direct', user_id: userId }) })
      setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [...prev, { ...conv, peer_name: name }]))
      setActive(conv.id)
    } catch (err) {
      toast(explain(err))
    }
  }

  function attachFiles(list: File[]) {
    if (!active) {
      toast(t('pickConversation'))
      return
    }
    if (!list.length) return
    setPending((prev) => [...prev, ...list])
  }

  function onDropFiles(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const list = Array.from(e.dataTransfer.files ?? [])
    if (list.length) attachFiles(list)
  }

  function setFileUrl(fileId: string, url: string) {
    setMessages((prev) => prev.map((m) => (m.files?.some((item) => item.id === fileId) ? { ...m, files: m.files?.map((item) => (item.id === fileId ? { ...item, url } : item)) } : m)))
  }

  function markGone(fileId: string) {
    setMessages((prev) => prev.map((m) => {
      if (!m.files?.some((item) => item.id === fileId && !item.gone)) return m
      const next = { ...m, files: m.files.map((item) => (item.id === fileId ? { ...item, gone: true } : item)) }
      void sealRow('records', m.id, 'messages', withoutUrls(next))
      return next
    }))
  }

  /** Object URL for a file that already exists on this device, decrypting lazily. */
  async function localUrl(file: ChatFile) {
    if (file.url) return file.url
    if (!stored.has(file.id)) return undefined
    const blob = await readBlob(file.id, file.mime || 'application/octet-stream')
    if (!blob) {
      markStored([], [file.id])
      return undefined
    }
    const url = URL.createObjectURL(blob)
    setFileUrl(file.id, url)
    return url
  }

  async function fetchMailbox(message: LocalMessage, file: ChatFile, ack: boolean) {
    let url = await localUrl(file)
    const senderId = message.senderId || conversations.find((c) => c.id === message.conversationId)?.peer_id || ''
    if (!url && file.via === 'peer') {
      if (transferLock.current && transferLock.current !== file.id) {
        toast(t('transferBusy'))
        return
      }
      if (file.gone) {
        toast(t('fileNotAvailableForTransfer'))
        return
      }
      const peers = onlinePeers(message.conversationId, senderId)
      if (!peers.length) {
        toast(message.mine ? t('fileNoLongerHere') : t('fileSenderOfflineLong'))
        return
      }
      // Already asked for or streaming this file: a second tap must not start a parallel pull.
      if (pull.current?.fileId === file.id || pullWatch.current?.fileId === file.id) return
      cancelledFiles.current.delete(file.id)
      busyRetry.current.delete(file.id)
      claimTransfer(file.id)
      setDownloading(file.id)
      bumpTransfer('receive', 0, file.size, file.id, senderId, true)
      watchPull(file.id)
      const ranked = await chooseHolder(file.id, peers)
      if (cancelledFiles.current.has(file.id)) {
        clearPullWatch(file.id)
        return
      }
      if (!ranked.length) {
        clearPullWatch(file.id)
        setDownloading(null)
        releaseTransfer(file.id)
        setTransfer((cur) => (cur?.fileId === file.id ? null : cur))
        markGone(file.id)
        toast(t('fileNotAvailableForTransfer'))
        return
      }
      askOrder.current.set(file.id, ranked)
      touchPullWatch(file.id)
      transport.sendFrame(newFrame('chat.file.request', { file_id: file.id }, { user: ranked[0] }))
      return
    }
    if (!url) {
      if (transferLock.current && transferLock.current !== file.id) {
        toast(t('transferBusy'))
        return
      }
      if (file.gone) {
        toast(t('fileNotOnServer'))
        return
      }
      // A second tap while this download runs would start a parallel copy.
      if (transferLock.current === file.id && abortFile.current === file.id) return
      cancelledFiles.current.delete(file.id)
      transferLock.current = file.id
      const download = new AbortController()
      transferAbort.current = download
      abortFile.current = file.id
      setDownloading(file.id)
      bumpTransfer('receive', 0, file.size, file.id, senderId, true)
      try {
        const blob = await apiBlobProgress(`/v1/mailbox/files/${file.id}`, (loaded, total) => {
          if (download.signal.aborted || cancelledFiles.current.has(file.id)) return
          bumpTransfer('receive', loaded, total || file.size, file.id, senderId)
        }, download.signal)
        if (cancelledFiles.current.has(file.id)) return
        const meta = file.key && file.header && file.lengths?.length ? { key: file.key, header: file.header, lengths: file.lengths } : null
        // Decrypt chunk by chunk from the blob, so large files never sit in one ciphertext and one plaintext buffer at once.
        const decoded = new Blob(meta ? (await decryptParts(blob, meta)) as BlobPart[] : [blob], { type: file.mime || 'application/octet-stream' })
        sessionFiles.current.set(file.id, decoded)
        url = URL.createObjectURL(decoded)
        const keep = meta ? keepCipher(file.id, blob, meta, file.size) : keepFile(file.id, decoded)
        void keep.then(({ kept, removed }) => {
          if (kept) markStored([file.id])
          dropMessages(removed)
          void refreshUsage()
        })
        setTransfer((cur) => (cancelledFiles.current.has(file.id) || cur?.fileId !== file.id ? cur : { ...cur, title: t('received'), loaded: cur.total || blob.size }))
        window.setTimeout(() => {
          setTransfer((cur) => (cur?.fileId === file.id ? null : cur))
          releaseTransfer(file.id)
        }, 600)
      } catch (err) {
        releaseTransfer(file.id)
        if (abortFile.current === file.id) {
          abortFile.current = ''
          transferAbort.current = null
        }
        setDownloading((cur) => (cur === file.id ? null : cur))
        setTransfer((cur) => (cur?.fileId === file.id ? null : cur))
        if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
      }
      setDownloading(null)
    }
    if (url) setFileUrl(file.id, url)
    if (ack && url && !message.mine && file.via !== 'peer') await api(`/v1/mailbox/files/${file.id}/ack`, { method: 'POST' }).catch(() => undefined)
    return url
  }

  function missFile(message: LocalMessage, err: unknown) {
    if (err instanceof ApiError && (err.code === 'not_found' || err.status === 404) && message.mine && message.status !== 'delivered' && message.status !== 'read') {
      const next = { ...message, status: 'expired' }
      setMessages((prev) => prev.map((m) => (m.id === message.id ? next : m)))
      void sealRow('records', message.id, 'messages', withoutUrls(next))
    }
    if (err instanceof ApiError && (err.code === 'not_found' || err.status === 404)) {
      const file = message.files?.find((item) => item.id === downloading) ?? message.files?.[0]
      if (file) markGone(file.id)
      toast(file?.via === 'peer' ? t('fileNotAvailableForTransfer') : t('fileNotOnServer'))
      return
    }
    toast(explainTransfer(err))
  }

  function saveUrl(url: string, name: string) {
    const link = document.createElement('a')
    link.href = url
    link.download = name || 'file'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function saveFile(message: LocalMessage, file: ChatFile) {
    try {
      const url = await fetchMailbox(message, file, true)
      if (url) saveUrl(url, file.name)
      else wantSave.current = file.id
    } catch (err) {
      setDownloading(null)
      transferLock.current = null
      transferKind.current = null
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
    if (!kind) {
      await saveFile(message, file)
      return
    }
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
      transferLock.current = null
      transferKind.current = null
      setTransfer(null)
      missFile(message, err)
    }
  }

  async function deleteLocally(message: LocalMessage) {
    if (!window.confirm(t('deleteMessageConfirm'))) return
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    await activeDatabase().records.delete(message.id)
    for (const file of message.files ?? []) {
      if (stored.has(file.id)) await forgetFile(file.id)
      outgoing.current.delete(file.id)
      sessionFiles.current.delete(file.id)
    }
    markStored([], (message.files ?? []).map((file) => file.id))
    await refreshUsage()
  }

  /** Remove a file from this device and, when possible, from the server / peer swarm. */
  async function revokeFile(message: LocalMessage, file: ChatFile) {
    const fromServer = message.mine && file.via !== 'peer' && !!file.key
    if (fromServer) {
      try {
        await api(`/v1/mailbox/cloud/${file.id}`, { method: 'DELETE' })
      } catch (err) {
        if (!(err instanceof ApiError && (err.code === 'not_found' || err.status === 404))) {
          toast(explain(err))
          return
        }
      }
    }
    outgoing.current.delete(file.id)
    sessionFiles.current.delete(file.id)
    if (stored.has(file.id)) await forgetFile(file.id)
    markStored([], [file.id])
    if (file.url) URL.revokeObjectURL(file.url)
    setFileUrl(file.id, '')
    markGone(file.id)
    for (const peer of onlinePeers(message.conversationId, message.senderId || me)) {
      transport.sendFrame(newFrame('chat.file.missing', { file_id: file.id }, { user: peer }))
    }
    await refreshUsage()
    toast(fromServer ? t('fileNotOnServer') : t('fileNotAvailableForTransfer'))
  }

  function onlinePeers(conversationId: string, senderId?: string) {
    const conv = conversations.find((item) => item.id === conversationId)
    const ids = conv?.kind === 'group'
      ? (conv.members ?? []).map((member) => member.id)
      : [senderId || conv?.peer_id || '']
    return [...new Set(ids)].filter((id) => id && id !== me && online.has(id))
  }

  /** Ask who has the file, then order them by the lowest ping. */
  function chooseHolder(fileId: string, users: string[]) {
    holdersRef.current.delete(fileId)
    missingRef.current.delete(fileId)
    return new Promise<string[]>((resolve) => {
      const found = new Map<string, number>()
      const pending = new Set(users)
      let settled = false
      let timer = 0
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        holderWaits.current.delete(fileId)
        void rankHolders(found).then(resolve)
      }
      timer = window.setTimeout(finish, 1500)
      holderWaits.current.set(fileId, { pending, found, finish })
      for (const userId of users) {
        probeStamp.current.set(`${fileId}:${userId}`, performance.now())
        transport.sendFrame(newFrame('chat.file.probe', { file_id: fileId }, { user: userId }))
      }
      if (!users.length) finish()
    })
  }

  async function rankHolders(found: Map<string, number>) {
    const ranked = await Promise.all([...found].map(async ([userId, probeRtt]) => {
      const live = await transport.rtt(userId)
      // Prefer holders who are not already serving us / busy locally when we know.
      const servingUs = [...peerUploads.current.values()].some((set) => set.has(userId)) ? 50 : 0
      return { userId, rtt: (live ?? probeRtt) + servingUs }
    }))
    ranked.sort((a, b) => a.rtt - b.rtt)
    return ranked.map((row) => row.userId)
  }

  function noteHave(fileId: string, userId: string) {
    if (!fileId || !userId) return
    const started = probeStamp.current.get(`${fileId}:${userId}`)
    const rtt = started ? Math.max(1, performance.now() - started) : 1000
    const map = holdersRef.current.get(fileId) ?? new Map<string, number>()
    map.set(userId, rtt)
    holdersRef.current.set(fileId, map)
    missingRef.current.get(fileId)?.delete(userId)
    const wait = holderWaits.current.get(fileId)
    if (wait) {
      wait.found.set(userId, rtt)
      wait.pending.delete(userId)
      if (wait.pending.size === 0) wait.finish()
    }
    setSwarmTick((n) => n + 1)
  }

  function nextHolder(fileId: string, userId: string) {
    const order = askOrder.current.get(fileId)
    if (!order || order[0] !== userId) return ''
    order.shift()
    return order[0] ?? ''
  }

  async function sourceFor(fileId: string): Promise<File | Blob | StoredFile | undefined> {
    const live = outgoing.current.get(fileId) ?? sessionFiles.current.get(fileId)
    if (live) return live
    return openStored(fileId).catch(() => undefined)
  }

  fileApi.current.request = (fileId, userId) => {
    void (async () => {
      // Already streaming this file to this peer: a second stream on the same channel would corrupt both.
      if (userId && peerUploads.current.get(fileId)?.has(userId)) {
        transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: userId }))
        return
      }
      cancelledFiles.current.delete(fileId)
      const source = await sourceFor(fileId)
      if (cancelledFiles.current.has(fileId)) return
      if (!source || !userId) {
        if (userId) transport.sendFrame(newFrame('chat.file.missing', { file_id: fileId }, { user: userId }))
        return
      }
      if (!beginPeerUpload(fileId, userId)) {
        transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: userId }))
        return
      }
      const claimed = claimTransfer(fileId)
      try {
        if (claimed) bumpTransfer('send', 0, source.size, fileId, userId, true)
        await sendFileChunks(source, fileId, userId)
      } finally {
        endPeerUpload(fileId, userId)
        if (claimed && transferLock.current === fileId && !(peerUploads.current.get(fileId)?.size)) {
          window.setTimeout(() => {
            if (transferLock.current === fileId && !(peerUploads.current.get(fileId)?.size)) {
              releaseTransfer(fileId)
              setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
            }
          }, 600)
        }
      }
    })()
  }
  fileApi.current.probe = (fileId, userId) => {
    if (!fileId || !userId) return
    void sourceFor(fileId).then((source) => {
      transport.sendFrame(newFrame(source ? 'chat.file.have' : 'chat.file.missing', { file_id: fileId }, { user: userId }))
    })
  }
  fileApi.current.have = (fileId, userId) => noteHave(fileId, userId)
  fileApi.current.missing = (fileId, userId) => {
    if (!fileId) return
    if (!userId) {
      clearPullWatch(fileId)
      markGone(fileId)
      releaseTransfer(fileId)
      setDownloading((cur) => (cur === fileId ? null : cur))
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      if (wantView.current === fileId || wantSave.current === fileId) toast(t('fileNotOnServer'))
      wantView.current = ''
      wantSave.current = ''
      setSwarmTick((n) => n + 1)
      return
    }
    const missed = missingRef.current.get(fileId) ?? new Set<string>()
    missed.add(userId)
    missingRef.current.set(fileId, missed)
    holdersRef.current.get(fileId)?.delete(userId)
    const wait = holderWaits.current.get(fileId)
    if (wait) {
      wait.pending.delete(userId)
      if (wait.pending.size === 0) wait.finish()
    }
    const next = nextHolder(fileId, userId)
    if (next) {
      touchPullWatch(fileId)
      transport.sendFrame(newFrame('chat.file.request', { file_id: fileId }, { user: next }))
      setSwarmTick((n) => n + 1)
      return
    }
    const order = askOrder.current.get(fileId)
    if (order && order.length === 0) {
      clearPullWatch(fileId)
      markGone(fileId)
      releaseTransfer(fileId)
      setDownloading((cur) => (cur === fileId ? null : cur))
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      if (wantView.current === fileId) toast(t('fileNotAvailableForTransfer'))
      wantView.current = ''
    }
    setSwarmTick((n) => n + 1)
  }
  fileApi.current.busy = (fileId, userId) => {
    const next = nextHolder(fileId, userId)
    if (next) {
      touchPullWatch(fileId)
      transport.sendFrame(newFrame('chat.file.request', { file_id: fileId }, { user: next }))
      return
    }
    const tries = busyRetry.current.get(fileId) ?? 0
    if (userId && tries < 4) {
      busyRetry.current.set(fileId, tries + 1)
      window.setTimeout(() => {
        if (cancelledFiles.current.has(fileId)) return
        touchPullWatch(fileId)
        askOrder.current.set(fileId, [userId])
        transport.sendFrame(newFrame('chat.file.request', { file_id: fileId }, { user: userId }))
      }, 2000)
      return
    }
    busyRetry.current.delete(fileId)
    clearPullWatch(fileId)
    releaseTransfer(fileId)
    setDownloading((cur) => (cur === fileId ? null : cur))
    setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
    toast(t('transferBusy'))
  }

  /** Stream a file to one peer over the data channel with back-pressure. Stored ciphertext is sent as is. */
  async function sendFileChunks(source: File | Blob | StoredFile, fileId: string, userId: string) {
    const devices = await api<{ id: string }[]>(`/v1/contacts/${userId}/devices`).catch(() => [])
    const deviceId = devices[0]?.id || ''
    const channel = deviceId ? await transport.ensurePeer(userId, deviceId, 8000) : null
    if (!channel || channel.readyState !== 'open') {
      if (userId) transport.sendFrame(newFrame('chat.file.busy', { file_id: fileId }, { user: userId }))
      return
    }
    const known = messagesRef.current.flatMap((message) => message.files ?? []).find((item) => item.id === fileId)
    const name = source instanceof File ? source.name || known?.name || 'file' : known?.name || 'file'
    const mime = source instanceof Blob ? source.type || known?.mime || 'application/octet-stream' : known?.mime || 'application/octet-stream'
    const size = source.size
    // Only a real cancel is an abort; a channel that closes mid-stream is a failure the user must hear about.
    const cancelled = () => cancelledFiles.current.has(fileId)
    let sent = 0
    const emit = async (chunk: Uint8Array, plainBytes: number) => {
      await Transport.drain(channel)
      if (cancelled()) throw new DOMException('aborted', 'AbortError')
      if (channel.readyState !== 'open') throw new Error('peer_closed')
      channel.send(chunk as unknown as ArrayBufferView<ArrayBuffer>)
      sent += plainBytes
      bumpTransfer('send', sent, size, fileId, userId)
    }
    try {
      if (!(source instanceof Blob) && source.kind === 'opfs') {
        channel.send(JSON.stringify({ t: 'file.start', file_id: fileId, name, mime, size, ...source.meta }))
        let offset = 0
        const overhead = source.meta.lengths.length ? Math.max(0, source.cipher.size - size) / source.meta.lengths.length : 0
        for (const length of source.meta.lengths) {
          const chunk = new Uint8Array(await source.cipher.slice(offset, offset + length).arrayBuffer())
          offset += length
          await emit(chunk, Math.max(0, length - overhead))
        }
      } else {
        const blob = source instanceof Blob ? source : new Blob([source.bytes as BlobPart])
        const enc = await createEncryptor(blob.size)
        channel.send(JSON.stringify({ t: 'file.start', file_id: fileId, name, mime, size, ...enc.meta }))
        for await (const { part, final } of blobParts(blob)) await emit(enc.push(part, final), part.byteLength)
      }
      channel.send(JSON.stringify({ t: 'file.end', file_id: fileId }))
      bumpTransfer('send', size, size, fileId, userId)
    } catch (err) {
      const userCancel = err instanceof DOMException && err.name === 'AbortError'
      const open = channel.readyState === 'open'
      if (open) {
        try {
          channel.send(JSON.stringify({ t: 'file.abort', file_id: fileId }))
        } catch {
          // the channel went away between the check and the send
        }
      } else if (!userCancel && userId) {
        // The data channel dropped mid-stream: tell the receiver over signaling so it does not wait for bytes.
        transport.sendFrame(newFrame('chat.file.cancel', { file_id: fileId, reason: 'interrupted' }, { user: userId }))
      }
      if (!userCancel) toast(open ? explainTransfer(err) : t('transferInterrupted'))
    }
    window.setTimeout(() => {
      setTransfer((cur) => (cur?.fileId === fileId && cur.peerId === userId ? null : cur))
    }, 600)
  }

  /** Start (or keep) the receive watchdog for a peer file this device is waiting on. */
  function watchPull(fileId: string) {
    const cur = pullWatch.current
    if (cur?.fileId === fileId) {
      cur.last = Date.now()
      return
    }
    if (cur) window.clearInterval(cur.timer)
    const timer = window.setInterval(() => {
      const watch = pullWatch.current
      if (!watch || watch.timer !== timer) {
        window.clearInterval(timer)
        return
      }
      if (Date.now() - watch.last >= PULL_STALL_MS) stallPull(watch.fileId)
    }, 5000)
    pullWatch.current = { fileId, last: Date.now(), timer }
  }

  function touchPullWatch(fileId: string) {
    if (pullWatch.current?.fileId === fileId) pullWatch.current.last = Date.now()
  }

  function clearPullWatch(fileId?: string) {
    const cur = pullWatch.current
    if (!cur || (fileId && cur.fileId !== fileId)) return
    window.clearInterval(cur.timer)
    pullWatch.current = null
  }

  /** Nothing arrived for too long: free the transfer slot, tell the holder to stop, and say so. */
  function stallPull(fileId: string) {
    clearPullWatch(fileId)
    const holder = pull.current?.fileId === fileId ? pull.current.from : askOrder.current.get(fileId)?.[0] ?? ''
    askOrder.current.delete(fileId)
    busyRetry.current.delete(fileId)
    // A late file.start for a pull we gave up on must not bring the bar back; a new tap clears this.
    cancelledFiles.current.add(fileId)
    if (holder) transport.sendFrame(newFrame('chat.file.cancel', { file_id: fileId }, { user: holder }))
    if (pull.current?.fileId === fileId) void abortPull(fileId, false)
    else {
      releaseTransfer(fileId)
      if (wantSave.current === fileId) wantSave.current = ''
      if (wantView.current === fileId) wantView.current = ''
      setDownloading((cur) => (cur === fileId ? null : cur))
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
    }
    toast(tRef.current('transferStalled'))
  }

  function beginPull(start: Omit<Pull, 'received' | 'parts' | 'queue' | 'decrypt' | 'sink' | 'failed'>) {
    if (cancelledFiles.current.has(start.fileId)) return
    const old = pull.current
    let settled: Promise<unknown> = Promise.resolve()
    if (old) {
      // A restart of the same file, or a different file, must not leak the previous slot's buffers and OPFS writer.
      pull.current = null
      old.failed = true
      old.parts = []
      settled = old.queue.catch(() => undefined).then(() => old.sink?.abort()).catch(() => undefined)
      if (old.fileId !== start.fileId) {
        releaseTransfer(old.fileId)
        if (wantSave.current === old.fileId) wantSave.current = ''
        if (wantView.current === old.fileId) wantView.current = ''
        setDownloading((cur) => (cur === old.fileId ? null : cur))
        setTransfer((cur) => (cur?.fileId === old.fileId ? null : cur))
      }
    }
    claimTransfer(start.fileId)
    busyRetry.current.delete(start.fileId)
    const slot: Pull = { ...start, received: 0, parts: [], queue: Promise.resolve(), decrypt: null, sink: null, failed: false }
    slot.queue = (async () => {
      // The old writer for the same file id must be gone before a new one opens it.
      await settled
      slot.decrypt = await pullDecryptor(slot.meta)
      slot.sink = await beginCipherFile(slot.fileId, slot.size).catch(() => null)
    })()
    pull.current = slot
    watchPull(start.fileId)
    setDownloading(start.fileId)
    bumpTransfer('receive', 0, start.size, start.fileId, start.from, true)
  }

  function pushPull(bytes: Uint8Array) {
    const slot = pull.current
    if (!slot || slot.failed) return
    touchPullWatch(slot.fileId)
    slot.queue = slot.queue.then(async () => {
      if (slot.failed || cancelledFiles.current.has(slot.fileId) || !slot.decrypt) return
      const plain = slot.decrypt(bytes)
      slot.parts.push(plain)
      slot.received += plain.byteLength
      if (slot.sink) await slot.sink.write(bytes).catch(() => { slot.sink = null })
      bumpTransfer('receive', slot.received, slot.size || slot.received, slot.fileId, slot.from)
    }).catch(() => {
      slot.failed = true
    })
  }

  async function finishPull(fileId: string) {
    const slot = pull.current
    if (!slot || slot.fileId !== fileId) return
    pull.current = null
    clearPullWatch(fileId)
    askOrder.current.delete(fileId)
    await slot.queue
    if (slot.failed || cancelledFiles.current.has(fileId)) {
      await slot.sink?.abort()
      releaseTransfer(fileId)
      setDownloading(null)
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      if (slot.failed) toast(t('transferFailed'))
      return
    }
    const blob = new Blob(slot.parts as BlobPart[], { type: slot.mime })
    slot.parts = []
    sessionFiles.current.set(fileId, blob)
    announceFileHave(fileId)
    const url = URL.createObjectURL(blob)
    const kept = slot.sink ? slot.sink.finish(slot.meta).then((removed) => ({ kept: true, removed })) : keepFile(fileId, blob)
    void kept.then(({ kept: ok, removed }) => {
      if (ok) markStored([fileId])
      dropMessages(removed)
      void refreshUsage()
    }).catch(() => undefined)
    setFileUrl(fileId, url)
    if (wantSave.current === fileId) {
      wantSave.current = ''
      saveUrl(url, slot.name)
    }
    if (wantView.current === fileId && (slot.mime.startsWith('image/') || slot.mime.startsWith('video/'))) {
      wantView.current = ''
      const owner = messagesRef.current.find((message) => message.files?.some((item) => item.id === fileId))
      setViewer({ src: url, name: slot.name, kind: slot.mime.startsWith('video/') ? 'video' : 'image', messageId: owner?.id ?? '', fileId, mine: !!owner?.mine, via: 'peer' })
    }
    setDownloading(null)
    setTransfer((cur) => (cur?.fileId === fileId ? { ...cur, title: t('received'), loaded: cur.total || cur.loaded } : cur))
    window.setTimeout(() => {
      setTransfer((cur) => (cur?.fileId === fileId ? null : cur))
      releaseTransfer(fileId)
    }, 600)
  }

  async function abortPull(fileId: string, remote: boolean) {
    const slot = pull.current
    if (!slot || (fileId && slot.fileId !== fileId)) return
    pull.current = null
    clearPullWatch(slot.fileId)
    slot.failed = true
    await slot.queue.catch(() => undefined)
    await slot.sink?.abort()
    releaseTransfer(slot.fileId)
    if (wantSave.current === slot.fileId) wantSave.current = ''
    if (wantView.current === slot.fileId) wantView.current = ''
    setDownloading((cur) => (cur === slot.fileId ? null : cur))
    setTransfer((cur) => (cur?.fileId === slot.fileId ? null : cur))
    if (remote) toast(t('transferCancelledBySender'))
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
    setPairId('')
    setPairCode('')
    setPairQr('')
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
  const selfChat = !!me && activeConv?.peer_id === me && activeConv?.kind !== 'group'
  const isGroup = activeConv?.kind === 'group'
  const fileRouteChoices = (() => {
    if (directOnly || !pending.length || !activeConv || selfChat) return false
    const recipients = recipientsOf(activeConv).filter((id) => id !== me)
    if (!recipients.length) return false
    const canDirect = recipients.some((id) => online.has(id))
    const canServer = pending.some((file) => fitsCloud(file.size))
    return canDirect && canServer
  })()
  useEffect(() => {
    if (!fileRouteChoices && fileRoute !== 'auto') setFileRoute('auto')
  }, [fileRouteChoices, fileRoute])

  // Read receipts only when this conversation is actually on screen — not while Chat is backgrounded on iOS.
  useEffect(() => {
    function markVisibleRead() {
      if (!active || !activeConv) return
      if (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus())) return
      const unread = messagesRef.current.filter((m) => m.conversationId === active && m.status !== 'read' && m.status !== 'expired' && m.status !== 'failed' && (selfChat ? m.mine : !m.mine))
      if (!unread.length) return
      const now = new Date().toISOString()
      if (!selfChat) {
        const bySender = new Map<string, string[]>()
        for (const m of unread) {
          const sender = m.senderId || activeConv.peer_id
          if (!sender || sender === me) continue
          bySender.set(sender, [...(bySender.get(sender) ?? []), m.id])
        }
        for (const [sender, ids] of bySender) transport.sendFrame(newFrame('chat.read', { message_ids: ids }, { user: sender }))
      }
      const ids = unread.map((m) => m.id)
      setMessages((prev) => prev.map((m) => {
        if (!ids.includes(m.id)) return m
        const next = { ...m, status: 'read', readAt: m.readAt || now, deliveredAt: m.deliveredAt || now }
        void sealRow('records', m.id, 'messages', withoutUrls(next))
        return next
      }))
    }
    markVisibleRead()
    document.addEventListener('visibilitychange', markVisibleRead)
    window.addEventListener('focus', markVisibleRead)
    return () => {
      document.removeEventListener('visibilitychange', markVisibleRead)
      window.removeEventListener('focus', markVisibleRead)
    }
  }, [active, activeConv, messages, selfChat, me])

  // Home-screen / taskbar badge: unread in unmuted conversations.
  useEffect(() => {
    if (!unlocked) {
      setAppBadge(0)
      return
    }
    const count = messages.filter((m) => {
      if (m.mine || m.status === 'read' || m.status === 'expired' || m.status === 'failed') return false
      if (prefs[m.conversationId]?.muted) return false
      if (active === m.conversationId && !document.hidden) return false
      return true
    }).length
    setAppBadge(count)
  }, [messages, prefs, active, unlocked])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const count = messagesRef.current.filter((m) => {
        if (m.mine || m.status === 'read' || m.status === 'expired' || m.status === 'failed') return false
        if (prefsRef.current[m.conversationId]?.muted) return false
        if (activeRef.current === m.conversationId) return false
        return true
      }).length
      setAppBadge(count)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Ask every online member whether they still have a peer file, so the status is right before a tap.
  useEffect(() => {
    if (!active || !activeConv || !wsOnline) return
    const now = Date.now()
    for (const m of thread) {
      for (const file of m.files ?? []) {
        if (file.via !== 'peer' || file.url || file.gone || stored.has(file.id) || sessionFiles.current.has(file.id)) continue
        for (const userId of onlinePeers(m.conversationId, m.senderId || activeConv.peer_id)) {
          const key = `${file.id}:${userId}`
          if (now - (probed.current.get(key) ?? 0) < PROBE_TTL) continue
          probed.current.set(key, now)
          probeStamp.current.set(key, performance.now())
          transport.sendFrame(newFrame('chat.file.probe', { file_id: file.id }, { user: userId }))
        }
      }
    }
    // onlinePeers is recreated each render; conversations, online, and me are already covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, activeConv, thread, online, stored, wsOnline, me, swarmTick])

  // Keep the newest message in view unless the reader scrolled up on purpose.
  useEffect(() => {
    const box = threadBox.current
    if (!box) return
    const last = thread[thread.length - 1]
    if (stickBottom.current || last?.mine) box.scrollTop = box.scrollHeight
  }, [thread, typing, transfer])
  useEffect(() => {
    stickBottom.current = true
    const box = threadBox.current
    if (box) box.scrollTop = box.scrollHeight
  }, [active])

  function availability(message: LocalMessage, file: ChatFile): FileAvailability {
    void swarmTick
    const onDisk = stored.has(file.id)
    const local = onDisk || !!file.url || sessionFiles.current.has(file.id) || outgoing.current.has(file.id)
    if (local && message.mine && file.via === 'peer') return onDisk ? 'sharing' : 'sessionOnly'
    if (local) return 'ready'
    if (file.gone) return 'gone'
    if (file.via !== 'peer') return message.status === 'expired' ? 'gone' : 'server'
    const peers = onlinePeers(message.conversationId, message.senderId)
    const haves = holdersRef.current.get(file.id)
    if (haves && [...haves.keys()].some((id) => peers.includes(id))) return 'peer'
    const missed = missingRef.current.get(file.id)
    if (!peers.length) return 'offline'
    if (missed && peers.every((id) => missed.has(id))) return 'gone'
    return 'peer'
  }

  function savePrefs(next: Record<string, ChatPref>) {
    setPrefs(next)
    if (session.user?.id) savePrefsStore(session.user.id, next)
  }

  function togglePref(conversationId: string, key: 'pinned' | 'muted') {
    const current = prefs[conversationId] ?? {}
    const conv = conversations.find((c) => c.id === conversationId)
    if (key === 'pinned') {
      const nextPinned = !isPinnedId(conversationId, conv?.peer_id, conv?.kind)
      const next: ChatPref = { ...current, pinned: nextPinned }
      if (nextPinned) next.pinnedAt = Date.now()
      else delete next.pinnedAt
      savePrefs({ ...prefs, [conversationId]: next })
      return
    }
    savePrefs({ ...prefs, [conversationId]: { ...current, muted: !current.muted } })
  }

  /** Saved messages stay pinned unless the user explicitly unpins. */
  function isPinnedId(conversationId: string, peerId?: string, kind?: string) {
    const self = !!me && peerId === me && kind !== 'group'
    if (self) return prefs[conversationId]?.pinned !== false
    return !!prefs[conversationId]?.pinned
  }

  function isPinnedConv(c: Conversation) {
    return isPinnedId(c.id, c.peer_id, c.kind)
  }

  async function clearHistory(conversationId: string) {
    if (!window.confirm(t('clearHistoryConfirm'))) return
    const doomed = messages.filter((m) => m.conversationId === conversationId)
    setMessages((prev) => prev.filter((m) => m.conversationId !== conversationId))
    const fileIds: string[] = []
    for (const message of doomed) {
      await activeDatabase().records.delete(message.id)
      for (const file of message.files ?? []) {
        if (stored.has(file.id)) await forgetFile(file.id)
        outgoing.current.delete(file.id)
        fileIds.push(file.id)
      }
    }
    markStored([], fileIds)
    await refreshUsage()
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

  function convSeed(c: Conversation) {
    if (c.kind === 'group') return `group:${c.id}`
    return c.peer_username || c.peer_name
  }

  function contactMenu(c: Conversation) {
    const self = c.peer_id === me && c.kind !== 'group'
    const pref = prefs[c.id] ?? {}
    const items = [
      { id: 'pin', label: isPinnedConv(c) ? t('unpin') : t('pin'), onSelect: () => togglePref(c.id, 'pinned') },
      { id: 'clear', label: t('clearHistory'), onSelect: () => void clearHistory(c.id) },
    ]
    if (c.kind === 'group') {
      items.push({ id: 'mute', label: pref.muted ? t('unmute') : t('mute'), onSelect: () => togglePref(c.id, 'muted') })
      items.push({ id: 'info', label: t('groupInfo'), onSelect: () => setGroupInfoFor(c.id) })
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
    const aPinned = isPinnedConv(a)
    const bPinned = isPinnedConv(b)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if (aPinned && bPinned) {
      const aAt = prefs[a.id]?.pinnedAt ?? 0
      const bAt = prefs[b.id]?.pinnedAt ?? 0
      if (aAt !== bAt) return aAt - bAt
      return a.id.localeCompare(b.id)
    }
    return lastAt(messages, b.id) - lastAt(messages, a.id)
  })
  const groupInfoConv = conversations.find((c) => c.id === groupInfoFor && c.kind === 'group') ?? null

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
          toast(t('userNotFound'))
          return
        }
      }
      const list = await api<Contact[]>('/v1/contacts')
      const person = list.find((item) => item.username.toLowerCase() === username.toLowerCase())
      if (!person) {
        toast(t('userNotFound'))
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

  const localDataSection = (
    <WipeLocalData>
      {unlocked ? (
        <>
          <SettingsRow label={t('storageUsed')} hint={`${t('storageChats', { size: formatBytes(usage.chatBytes) })} · ${t('storageFiles', { size: formatBytes(usage.fileBytes) })}${usage.queueBytes ? ` · ${t('storageQueue', { size: formatBytes(usage.queueBytes) })}` : ''}`}>
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
                  const next = text === '' ? 0 : Math.min(200, Number(text))
                  setLimitGb(next)
                  if (session.user?.id) saveStorageGb(session.user.id, next)
                  if (next === 0) return
                  void enforceStorageLimit().then(async (removed) => {
                    dropMessages(removed)
                    setStored(await storedIds())
                    await refreshUsage()
                  })
                }}
              />
              <span className="text-sm text-muted">GB</span>
            </span>
          </SettingsRow>
          <SettingsRow label={t('cleanStorage')} hint={t('cleanStorageHint')}>
            <Button variant="outline" onClick={() => void cleanOldFiles().then(async (result) => {
              dropMessages(result.messageIds)
              setStored(await storedIds())
              await refreshUsage()
              const parts = []
              if (result.fileCount) parts.push(t('cleanStorageFiles', { count: result.fileCount, size: formatBytes(result.bytes) }))
              if (result.messageIds.length) parts.push(t('cleanStorageMessages', { count: result.messageIds.length }))
              toast(parts.length ? parts.join(' ') : t('cleanStorageEmpty'))
            })}>{t('cleanStorage')}</Button>
          </SettingsRow>
        </>
      ) : null}
    </WipeLocalData>
  )

  const chatSettings = session.user ? (
    <AppSettings>
      <SettingsSection title={t('chat')}>
        <SettingsRow label={t('enterToSend')} hint={t('enterToSendHint')}>
          <Switch checked={enterToSend} onCheckedChange={(on) => { setEnterToSend(on); localStorage.setItem('ma.chat.enterToSend', on ? '1' : '0') }} label={t('enterToSend')} />
        </SettingsRow>
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
        <SettingsRow label={t('notifications')} hint={t('notificationsHint')}>
          <Switch
            checked={notifyOn}
            onCheckedChange={(on) => {
              if (!on) {
                setNotifyPref(false)
                setNotifyOn(false)
                return
              }
              void enablePush().then((ok) => {
                setNotifyOn(ok)
                if (!ok) toast(t('notificationsDenied'))
              }).catch(() => {
                setNotifyPref(false)
                setNotifyOn(false)
                toast(t('notificationsDenied'))
              })
            }}
            label={t('notifications')}
          />
        </SettingsRow>
        <SettingsRow label={t('hideSenderNames')} hint={t('hideSenderNamesHint')}>
          <Switch
            checked={hideSenderNames}
            onCheckedChange={(on) => {
              setHideSenderNames(on)
              localStorage.setItem('ma.chat.hideSenderNames', on ? '1' : '0')
              hideSenderNamesRef.current = on
              syncNotifyPref()
            }}
            label={t('hideSenderNames')}
          />
        </SettingsRow>
        <SettingsRow label={t('hideNotifyBody')} hint={t('hideNotifyBodyHint')}>
          <Switch
            checked={hideNotifyBody}
            onCheckedChange={(on) => {
              setHideNotifyBody(on)
              localStorage.setItem('ma.chat.hideNotifyBody', on ? '1' : '0')
              hideNotifyBodyRef.current = on
              syncNotifyPref()
            }}
            label={t('hideNotifyBody')}
          />
        </SettingsRow>
        <SettingsRow label={t('relayOnly')} hint={t('relayOnlyHint')}>
          <Switch
            checked={relay}
            onCheckedChange={(on) => {
              setRelay(on)
              localStorage.setItem('ma.chat.relayOnly', on ? '1' : '0')
              if (on && directOnly) {
                setDirectOnly(false)
                transport.directOnly = false
                localStorage.setItem('ma.chat.directOnly', '0')
              }
            }}
            label={t('relayOnly')}
          />
        </SettingsRow>
        <SettingsRow label={t('directOnly')} hint={t('directOnlyHint')}>
          <Switch
            checked={directOnly}
            onCheckedChange={(on) => {
              setDirectOnly(on)
              transport.directOnly = on
              localStorage.setItem('ma.chat.directOnly', on ? '1' : '0')
              if (on && relay) {
                setRelay(false)
                localStorage.setItem('ma.chat.relayOnly', '0')
              }
            }}
            label={t('directOnly')}
          />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title={t('security')} description={t('securityLead')}>
        <SettingsRow label={t('vaultPassword')} hint={t('vaultPasswordSeparate')}>
          <Button variant="outline" onClick={() => setVaultDialog(true)}>{t('change')}</Button>
        </SettingsRow>
        <SettingsRow label={t('webauthnUnlock')} hint={t('webauthnUnlockHint')}>
          {webAuthnReady ? (
            <Button
              variant="outline"
              onClick={() => {
                void disableWebAuthnUnlock()
                  .then(() => {
                    setWebAuthnReady(false)
                    toast(t('webauthnDisabled'))
                  })
                  .catch((err) => toast(explain(err)))
              }}
            >
              {t('webauthnDisable')}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!webAuthnCapable}
              onClick={() => {
                const me = session.user
                void enableWebAuthnUnlock({
                  userName: me?.username || 'chat',
                  displayName: me?.display_name || me?.username || 'Chat',
                })
                  .then(() => {
                    setWebAuthnReady(true)
                    toast(t('webauthnEnabled'))
                  })
                  .catch((err) => {
                    const code = err instanceof Error ? err.message : ''
                    const name = err instanceof DOMException ? err.name : ''
                    if (code === 'webauthn_unavailable') toast(t('webauthnUnavailable'))
                    else if (code === 'webauthn_prf_unsupported') toast(t('webauthnPrfUnsupported'))
                    else if (code === 'webauthn_cancelled' || name === 'NotAllowedError' || name === 'AbortError' || /NotAllowed|Abort|denied permission|not allowed by the user agent/i.test(code)) toast(t('webauthnCancelled'))
                    else toast(explain(err))
                  })
              }}
            >
              {t('webauthnEnable')}
            </Button>
          )}
        </SettingsRow>
        <SettingsRow label={t('recoveryKey')} hint={t('recoveryKeyHint')}>
          <Button variant="outline" onClick={() => void addRecoverySlot().then(setRecoveryKey).catch((err) => toast(explain(err)))}>{t('create')}</Button>
        </SettingsRow>
        <SettingsRow label={t('lock')} hint={t('lockHint')}>
          <Button variant="outline" onClick={() => { lockVault(); setUnlocked(false) }}>{t('lockVault')}</Button>
        </SettingsRow>
        <SettingsRow label={t('twoFactor')} hint={totpEnabled ? t('twoFactorOn') : t('twoFactorHint')}>
          <Button variant="outline" onClick={() => setTotpOpen(true)}>{totpEnabled ? t('reconfigure') : t('setupTotp')}</Button>
        </SettingsRow>
        <div className="px-4 py-3">
          <VaultExplainer />
        </div>
      </SettingsSection>
      <SettingsSection title={t('devices')} description={t('devicesLead')}>
        <DeviceList enabled={mode === 'app'} userId={session.user?.id || ''} />
        {identityOutOfSync ? (
          <SettingsRow label={t('useThisDeviceKey')} hint={t('useThisDeviceKeyHint')}>
            <Button variant="outline" onClick={() => void reclaimIdentityKey()}>{t('useThisDeviceKey')}</Button>
          </SettingsRow>
        ) : null}
        <SettingsRow label={t('linkDevice')} hint={t('linkDeviceHint')}>
          <Button variant="outline" onClick={() => void startPair().catch((err) => toast(explain(err)))}>{t('linkDevice')}</Button>
        </SettingsRow>
        {pairId ? (
          <div className="space-y-2 px-4 py-3">
            <p className="text-sm text-muted">{t('pairingInstructions')}</p>
            <p className="text-xs text-muted">{t('pairingId')}: <span className="font-mono text-sm text-fg select-all">{pairId}</span></p>
            <p className="text-xs text-muted">{t('pairingCode')}: <span className="font-mono text-sm text-fg select-all">{pairCode}</span></p>
            {pairQr ? <img alt={t('pairingQr')} src={pairQr} className="size-40 rounded-md bg-white p-1" /> : null}
            {pairFingerprint ? <p className="text-xs text-muted">{t('fingerprint')}: <span className="font-mono">{pairFingerprint}</span></p> : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void approvePair().catch((err) => toast(explain(err)))}>{t('confirmPairing')}</Button>
              <Button variant="ghost" onClick={() => { void api(`/v1/devices/pairing/${pairId}/cancel`, { method: 'POST' }).catch(() => undefined); setPairId(''); setPairCode(''); setPairQr(''); setPairFingerprint('') }}>{t('cancel')}</Button>
            </div>
          </div>
        ) : null}
      </SettingsSection>
      <SettingsSection title={t('cloudStorage')} description={t('cloudStorageLead', { limit: formatBytes(MAILBOX_USER_QUOTA_BYTES) })}>
        <SettingsRow label={t('cloudUsedLabel')} hint={t('cloudExpires')}>
          <Button variant="outline" onClick={() => void api<CloudUsage>('/v1/mailbox/cloud').then((row) => {
            const usage = cloudUsage(row)
            if (usage) setCloudPrompt({ usage, need: 0, canDirect: false })
          }).catch((err) => toast(explain(err)))}>{t('cloudManage')}</Button>
        </SettingsRow>
      </SettingsSection>
      {localDataSection}
    </AppSettings>
  ) : null

  if (mode !== 'app') {
    return (
      <>
        <AppSettings>{localDataSection}</AppSettings>
        <SkyBackdrop scene="chat" />
        <AuthScreens mode={mode} onMode={setMode} onLogin={onLogin} onRegister={onRegister} on2fa={on2fa} />
      </>
    )
  }

  if (!unlocked) {
    return (
      <>
        <AppSettings>{localDataSection}</AppSettings>
        <SkyBackdrop scene="chat" />
        <UnlockScreen
          mode={vaultExists === false ? 'create' : 'unlock'}
          onUnlock={onUnlock}
          onUnlockWebAuthn={webAuthnReady ? onUnlockWebAuthn : undefined}
          webAuthnReady={webAuthnReady}
          pending={session.trust === 'pending'}
          onTransfer={() => setAskTransfer(true)}
          onFresh={(password) => { void beginFresh(password) }}
        />
        <TransferPrompt
          open={askTransfer}
          onLater={() => {
            if (session.user?.id) dismissTransfer(session.user.id)
            setAskTransfer(false)
          }}
          onFresh={(password) => { void beginFresh(password) }}
          onTransfer={async (pairingId, code, nextPassword) => {
            const problem = vaultPasswordError(nextPassword)
            if (problem) throw new Error(problem)
            transferPassword.current = nextPassword
            try {
              await claimPair(pairingId, code)
              setAskTransfer(false)
            } catch (err) {
              throw new Error(explain(err))
            }
          }}
        />
      </>
    )
  }

  return (
    <>
    {chatSettings}
    <CloudQuotaDialog
      open={!!cloudPrompt}
      usage={cloudPrompt?.usage ?? null}
      need={cloudPrompt?.need ?? 0}
      titleFor={(conversationId) => {
        const conv = conversations.find((item) => item.id === conversationId)
        return conv ? convTitle(conv) : ''
      }}
      onOpenChange={(open) => { if (!open) setCloudPrompt(null) }}
      onSendDirect={cloudPrompt?.canDirect ? () => { setCloudPrompt(null); void send('direct') } : undefined}
      onRemove={(fileId) => void api(`/v1/mailbox/cloud/${fileId}`, { method: 'DELETE' }).then(async () => {
        markGone(fileId)
        const usage = cloudUsage(await api<CloudUsage>('/v1/mailbox/cloud'))
        setCloudPrompt((cur) => (cur && usage ? { ...cur, usage } : cur))
      }).catch((err) => toast(explain(err)))}
    />
    <RecoveryKeyDialog value={recoveryKey} onClose={() => setRecoveryKey('')} />
    <TotpDialog open={totpOpen} onOpenChange={setTotpOpen} onEnabled={() => setTotpEnabled(true)} />
    <GroupInfo
      conversation={groupInfoConv}
      me={me || ''}
      contacts={contacts}
      online={online}
      open={!!groupInfoConv}
      onOpenChange={(open) => { if (!open) setGroupInfoFor(null) }}
      onChanged={refresh}
      onLeft={() => {
        setGroupInfoFor(null)
        if (active === groupInfoFor) setActive(null)
      }}
    />
    <Dialog open={vaultDialog} onOpenChange={setVaultDialog} title={t('changeVaultPassword')} description={t('changeVaultPasswordLead')}>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault()
        const problem = vaultPasswordError(nextVaultPassword)
        if (problem) {
          toast(problem)
          return
        }
        if (nextVaultPassword === currentVaultPassword) {
          toast(t('vaultPasswordSame'))
          return
        }
        void changeVaultPassword(currentVaultPassword, nextVaultPassword).then(() => {
          setVaultDialog(false)
          setCurrentVaultPassword('')
          setNextVaultPassword('')
          toast(t('vaultPasswordChanged'))
        }).catch(() => toast(t('wrongVaultPassword')))
      }}>
        <Input type="password" placeholder={t('currentPassword')} aria-label={t('currentPassword')} autoComplete="current-password" value={currentVaultPassword} onChange={(e) => setCurrentVaultPassword(e.target.value)} />
        <Input type="password" placeholder={t('newPassword')} aria-label={t('newPassword')} autoComplete="new-password" value={nextVaultPassword} onChange={(e) => setNextVaultPassword(e.target.value)} />
        <Button type="submit">{t('change')}</Button>
      </form>
    </Dialog>
    <TransferPrompt
      open={askTransfer && !!unlocked}
      onLater={() => {
        if (session.user?.id) dismissTransfer(session.user.id)
        setAskTransfer(false)
      }}
      onFresh={(password) => { void beginFresh(password) }}
      onTransfer={async (pairingId, code, nextPassword) => {
        const problem = vaultPasswordError(nextPassword)
        if (problem) throw new Error(problem)
        transferPassword.current = nextPassword
        try {
          await claimPair(pairingId, code)
          setAskTransfer(false)
        } catch (err) {
          throw new Error(explain(err))
        }
      }}
    />
    <div className="relative grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]">
      <SkyBackdrop scene={activeConv ? 'conversation' : 'chat'} />
      <aside className={`${active ? 'hidden' : 'flex'} relative z-[1] min-h-0 min-w-0 flex-col border-line bg-transparent backdrop-blur-sm md:flex md:border-r`}>
        <form onSubmit={addContact} className="flex shrink-0 flex-col gap-2 border-b border-line p-3">
          <Input placeholder={t('friendUsername')} aria-label={t('friendUsername')} autoComplete="off" value={lookup} onChange={(e) => setLookup(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
          <Button type="submit" variant="outline" className="w-full">{t('add')}</Button>
          <CreateGroup className="w-full" contacts={contacts} onCreate={async (title, memberIds) => {
            if (groupNameError(title)) {
              toast(groupNameError(title))
              return
            }
            try {
              const conv = await api<Conversation>('/v1/conversations', { method: 'POST', body: JSON.stringify({ kind: 'group', title, member_ids: memberIds }) })
              setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [...prev, conv]))
              setActive(conv.id)
              await refresh()
            } catch (err) {
              toast(explain(err))
            }
          }} />
          </div>
        </form>
        {session.trust === 'pending' ? <Button type="button" variant="ghost" className="mx-3 mt-2" onClick={() => setAskTransfer(true)}>{t('transferChats')}</Button> : null}
        {!wsOnline ? <p className="shrink-0 px-3 pt-2 text-xs text-muted">{t('reconnecting')}</p> : null}
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {me && !conversations.some((c) => c.peer_id === me && c.kind !== 'group') ? (
            <button type="button" className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-left transition hover:bg-surface-2" onClick={() => void openDirect(me, session.user?.display_name || '')}>
              <SavedMessagesAvatar />
              <span className="min-w-0 flex-1 truncate text-sm">{t('savedMessages')}</span>
              <Pin className="size-3.5 shrink-0 text-muted" aria-hidden />
            </button>
          ) : null}
          {orderedConversations.map((c) => {
            const latest = [...messages].reverse().find((m) => m.conversationId === c.id)
            const self = c.peer_id === me && c.kind !== 'group'
            const group = c.kind === 'group'
            const pinned = isPinnedConv(c)
            const preview = latest ? `${group && latest.senderId ? `${memberName(c, latest.senderId)}: ` : ''}${latest.body || latest.files?.[0]?.name || ''}` : ''
            return (
            <HoldMenu key={c.id} label={convTitle(c)} items={contactMenu(c)}>
            <div role="button" tabIndex={0} className={`ma-focusable flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-left transition hover:bg-surface-2/80 ${c.id === active ? 'bg-surface-2/90' : ''}`} onClick={() => setActive(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActive(c.id) }}>
              <span className="relative shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                {self ? (
                  <SavedMessagesAvatar />
                ) : group ? (
                  <button type="button" className="cursor-pointer" aria-label={t('groupInfo')} onClick={() => setGroupInfoFor(c.id)}>
                    <UserAvatar username={convSeed(c)} />
                  </button>
                ) : (
                  <ProfileButton username={c.peer_username || c.peer_name} displayName={convTitle(c)} actions={profileActions(c.peer_id, c.id)}>
                    <UserAvatar username={convSeed(c)} />
                  </ProfileButton>
                )}
                {!group && !self ? <span className="pointer-events-none absolute right-0 bottom-0"><PresenceDot online={online.has(c.peer_id)} /></span> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm">{convTitle(c)}{!self && prefs[c.id]?.muted ? ` · ${t('mute')}` : ''}{!self && !group && blocked(c.peer_id) ? ` · ${t('blocked')}` : ''}</span>
                  {pinned ? <Pin className="size-3 shrink-0 text-muted" aria-label={t('pin')} /> : null}
                </span>
                {preview ? <span className="block truncate text-xs text-muted">{preview}</span> : group ? <span className="block truncate text-xs text-muted">{t('groupMembersCount', { count: c.members?.length ?? 0, max: 20 })}</span> : null}
              </span>
            </div>
            </HoldMenu>
            )
          })}
          {contacts.filter((c) => (c.state === 'accepted' || c.state === 'blocked') && c.id !== me && !conversations.some((conv) => conv.peer_id === c.id && conv.kind !== 'group')).map((c) => (
            <HoldMenu key={c.id} label={c.display_name || c.username} items={[{ id: 'block', label: blocked(c.id) ? t('unblock') : t('block'), onSelect: () => void setBlocked(c.id, !blocked(c.id)) }]}>
            <div role="button" tabIndex={0} className="ma-focusable flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-left transition hover:bg-surface-2/80" onClick={() => void openDirect(c.id, c.display_name || c.username)} onKeyDown={(e) => { if (e.key === 'Enter') void openDirect(c.id, c.display_name || c.username) }}>
              <span className="relative shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProfileButton username={c.username} displayName={c.display_name} actions={profileActions(c.id)}>
                  <UserAvatar username={c.username} />
                </ProfileButton>
                <span className="pointer-events-none absolute right-0 bottom-0"><PresenceDot online={online.has(c.id)} /></span>
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.display_name || c.username}{c.state === 'blocked' ? ` · ${t('blocked')}` : ''}</span>
            </div>
            </HoldMenu>
          ))}
          {!conversations.length && !contacts.some((c) => c.id !== me) ? <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted">{t('emptyContacts')}</p> : null}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden'} relative z-[1] min-h-0 min-w-0 flex-col md:flex`}>
        {activeConv ? (
          <>
            <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-transparent px-2 backdrop-blur-sm">
              <IconButton label={t('back')} className="md:hidden" onClick={() => setActive(null)}>
                <BackIcon />
              </IconButton>
              {isGroup ? (
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setGroupInfoFor(activeConv.id)}>
                  <UserAvatar username={convSeed(activeConv)} className="size-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{convTitle(activeConv)}</span>
                    <span className="block truncate text-xs text-muted">
                      {t('groupMembersCount', { count: activeConv.members?.length ?? 0, max: 20 })}
                      {(() => {
                        const count = (activeConv.members ?? []).filter((member) => member.id !== me && online.has(member.id)).length
                        return count ? ` · ${t('membersOnline', { count })}` : ''
                      })()}
                    </span>
                  </span>
                </button>
              ) : selfChat ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <SavedMessagesAvatar className="size-9" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{convTitle(activeConv)}</span>
                  </span>
                </div>
              ) : (
                <ProfileButton className="min-w-0 flex-1" username={activeConv.peer_username || activeConv.peer_name} displayName={convTitle(activeConv)} actions={profileActions(activeConv.peer_id, activeConv.id)}>
                  <UserAvatar username={convSeed(activeConv)} className="size-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{convTitle(activeConv)}</span>
                    <span className="block text-xs text-muted">{online.has(activeConv.peer_id) ? t('online') : t('offline')}</span>
                  </span>
                </ProfileButton>
              )}
            </div>
            <div
              ref={threadBox}
              className={`relative min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 ${dragOver ? 'outline outline-2 outline-dashed outline-accent/50' : ''}`}
              onScroll={(e) => {
                const box = e.currentTarget
                stickBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 120
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                if (e.dataTransfer.types.includes('Files')) setDragOver(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
              }}
              onDrop={onDropFiles}
            >
              {dragOver ? <p className="pointer-events-none absolute inset-x-0 top-3 z-10 text-center text-sm text-accent">{t('dropFilesHere')}</p> : null}
              {!thread.length ? <p className="py-10 text-center text-sm text-muted">{isGroup ? t('emptyGroup') : t('emptyThread')}</p> : null}
              {thread.map((m, i) => {
                const previous = thread[i - 1]
                const sameSender = previous?.mine === m.mine && (!isGroup || previous?.senderId === m.senderId)
                const dayChanged = !previous || dayKey(previous.at) !== dayKey(m.at)
                return (
                <div key={m.id}>
                  {dayChanged ? <DayDivider label={dayLabel(m.at, t)} /> : null}
                  <MessageBubble
                    mine={m.mine}
                    grouped={sameSender && !dayChanged}
                    time={localTime(m.at, hourCycle)}
                    status={m.mine ? messageStatusLabel(t, m, isGroup ? activeConv : undefined, me) : undefined}
                    sender={isGroup && !m.mine ? memberName(activeConv, m.senderId) || t('unknownMember') : undefined}
                    menu={{
                      label: t('message'),
                      items: [
                        ...(m.body ? [{ id: 'copy', label: t('copy'), onSelect: () => void navigator.clipboard.writeText(m.body).then(() => toast(t('copied'))) }] : []),
                        ...(m.mine ? [{ id: 'status', label: t('messageStatus'), onSelect: () => setStatusFor(m) }] : []),
                        { id: 'delete', label: t('deleteForMe'), onSelect: () => void deleteLocally(m) },
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
                          availability={(file) => availability(m, file)}
                          onExpand={() => setOpenFiles((prev) => new Set(prev).add(m.id))}
                          onDownload={(file) => void saveFile(m, file)}
                          onView={(file) => void viewFile(m, file)}
                          fileMenu={(file) => [
                            ...(file.mime.startsWith('image/') || file.mime.startsWith('video/') ? [{ id: 'view', label: t('view'), onSelect: () => void viewFile(m, file) }] : []),
                            ...(availability(m, file) !== 'gone' ? [{ id: 'download', label: t('download'), onSelect: () => void saveFile(m, file) }] : []),
                            { id: 'share', label: t('share'), onSelect: () => void shareFile(m, file) },
                            ...(stored.has(file.id) && !m.mine ? [{ id: 'forget', label: t('removeFromDevice'), onSelect: () => void forgetFile(file.id).then(() => { markStored([], [file.id]); setFileUrl(file.id, ''); void refreshUsage() }) }] : []),
                            ...(m.mine && !file.gone && (file.via === 'mailbox' || stored.has(file.id) || sessionFiles.current.has(file.id) || outgoing.current.has(file.id))
                              ? [{
                                  id: 'revoke',
                                  label: file.via === 'mailbox' ? t('removeFromServer') : t('stopSharing'),
                                  onSelect: () => void revokeFile(m, file),
                                }]
                              : []),
                          ]}
                        />
                      ) : null}
                    </div>
                  </MessageBubble>
                </div>
                )
              })}
              {typing?.conversationId === active && !prefs[active]?.muted ? <TypingIndicator name={typing.name || '…'} /> : null}
            </div>
            {transfer ? <div className="shrink-0 px-3 pb-2"><TransferProgress title={transfer.title} loaded={transfer.loaded} total={transfer.total} startedAt={transfer.startedAt} onCancel={stopTransfer} /></div> : null}
            <form
              className="flex shrink-0 flex-col gap-2 border-t border-line bg-transparent p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={onDropFiles}
            >
              {pending.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex max-w-full gap-1 overflow-x-auto">
                    {pending.map((file, index) => (
                      <span key={`${file.name}-${file.size}-${index}`} className="inline-flex max-w-44 shrink-0 items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs">
                        <span className="truncate">{file.name || 'file'}</span>
                        <span className="shrink-0 text-muted">{formatBytes(file.size)}</span>
                        <button type="button" className="text-muted" aria-label={t('removeFile')} onClick={() => setPending((prev) => prev.filter((_, i) => i !== index))}>×</button>
                      </span>
                    ))}
                  </div>
                  {fileRouteChoices ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted">{t('sendRouteHint')}</span>
                      {([
                        ['auto', 'sendAuto'],
                        ['direct', 'sendDirect'],
                        ['server', 'sendViaServer'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`ma-focusable rounded-md px-2 py-1 ${fileRoute === value ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'}`}
                          onClick={() => setFileRoute(value)}
                        >
                          {t(label)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex min-w-0 items-end gap-2">
              <FileButton label={t('attachment')} onPick={attachFiles} />
              <Textarea
                className="max-h-32 min-h-11 flex-1"
                rows={1}
                placeholder={t('messagePlaceholder')}
                aria-label={t('message')}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (e.target.value.trim() && activeConv && !selfChat) notifyTyping(activeConv)
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
          <div className="m-6 max-w-sm self-center rounded-lg border border-line/70 bg-bg/50 p-5 text-sm leading-relaxed text-muted backdrop-blur-md md:self-auto">
            <p className="font-medium text-fg">{t('pickConversation')}</p>
            <p className="mt-1">{t('pickConversationHint')}</p>
          </div>
        )}
      </section>
    </div>
    {viewer ? <Lightbox src={viewer.src} alt={viewer.name} caption={viewer.name} fileName={viewer.name} kind={viewer.kind} onClose={() => setViewer(null)} onDownload={() => { if (!viewer.mine && viewer.via !== 'peer' && viewer.fileId) void api(`/v1/mailbox/files/${viewer.fileId}/ack`, { method: 'POST' }).catch(() => undefined) }} /> : null}
    <Dialog open={!!statusMessage} onOpenChange={(open) => { if (!open) setStatusFor(null) }} title={t('messageStatus')}>
      {statusMessage ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>{t('statusSent')}</dt><dd>{stamp(statusMessage.at, hourCycle)}</dd></div>
          {statusMessage.route ? <div className="flex justify-between gap-4"><dt>{t('sentHow')}</dt><dd>{t(statusMessage.route === 'server' ? 'viaServer' : statusMessage.route === 'mixed' ? 'viaMixed' : 'viaDirect')}</dd></div> : null}
          {(() => {
            const conv = conversations.find((item) => item.id === statusMessage.conversationId)
            const group = conv?.kind === 'group'
            const members = (conv?.members ?? []).filter((member) => member.id && member.id !== me)
            if (group && members.length) {
              const delivered = new Map((statusMessage.receipts?.delivered ?? []).map((row) => [row.userId, row.at]))
              const read = new Map((statusMessage.receipts?.read ?? []).map((row) => [row.userId, row.at]))
              return (
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="text-xs text-muted">{t('seenBy', { count: read.size, total: members.length })}</p>
                  <ul className="space-y-2">
                    {members.map((member) => {
                      const seenAt = read.get(member.id)
                      const deliveredAt = delivered.get(member.id)
                      return (
                        <li key={member.id} className="flex items-center justify-between gap-3">
                          <span className="truncate">{member.display_name || member.username}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {seenAt ? stamp(seenAt, hourCycle) : deliveredAt ? t('statusDelivered') : t('pending')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            }
            return (
              <>
                <div className="flex justify-between gap-4"><dt>{t('statusDelivered')}</dt><dd>{statusMessage.deliveredAt ? stamp(statusMessage.deliveredAt, hourCycle) : statusMessage.status === 'delivered' || statusMessage.status === 'read' ? t('statusDelivered') : t('pending')}</dd></div>
                <div className="flex justify-between gap-4"><dt>{t('statusRead')}</dt><dd>{statusMessage.readAt ? stamp(statusMessage.readAt, hourCycle) : statusMessage.status === 'read' ? t('statusRead') : t('pending')}</dd></div>
              </>
            )
          })()}
        </dl>
      ) : null}
    </Dialog>
    </>
  )
}

/** Mark files this device keeps and create preview URLs only for small images/audio; everything else decrypts on demand. */
async function attachCachedFiles(rows: LocalMessage[]) {
  const kept = await storedIds().catch(() => new Set<string>())
  const next: LocalMessage[] = []
  for (const row of rows) {
    if (!row.files?.length) {
      next.push(row)
      continue
    }
    const files = await Promise.all(row.files.map(async (file) => {
      if (file.url || !kept.has(file.id)) return file
      const inline = (file.mime.startsWith('image/') || file.mime.startsWith('audio/')) && file.size <= INLINE_PREVIEW_BYTES
      if (!inline) return file
      const blob = await readBlob(file.id, file.mime || 'application/octet-stream').catch(() => undefined)
      if (!blob) return file
      return { ...file, url: URL.createObjectURL(blob) }
    }))
    next.push({ ...row, files })
  }
  return { messages: next, kept }
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

function dayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(iso: string, translate: (key: string) => string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return translate('today')
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return translate('yesterday')
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function withoutUrls(message: LocalMessage): LocalMessage {
  return { ...message, files: message.files?.map(({ url: _url, ...file }) => file) }
}

function messageStatusLabel(
  translate: (key: string, opts?: Record<string, unknown>) => string,
  message: LocalMessage,
  conv: { kind?: string; members?: { id: string }[] } | undefined,
  me: string | undefined,
) {
  if (conv?.kind === 'group') {
    const total = (conv.members ?? []).filter((member) => member.id && member.id !== me).length
    const read = message.receipts?.read?.length ?? 0
    const delivered = message.receipts?.delivered?.length ?? 0
    if (total > 0 && (read > 0 || delivered > 0 || message.status === 'delivered' || message.status === 'read')) {
      const count = read > 0 ? read : delivered
      const key = read > 0 ? 'seenBy' : 'deliveredTo'
      const base = translate(key, { count, total })
      const routeBit =
        message.route === 'direct' ? translate('viaDirect') : message.route === 'server' ? translate('viaServer') : message.route === 'mixed' ? translate('viaMixed') : ''
      return routeBit ? `${routeBit} · ${base}` : base
    }
  }
  return statusLabel(translate, message.status, message.route)
}

function statusLabel(translate: (key: string) => string, status: string, route?: string) {
  let base = status
  if (status === 'sending' || status === 'queued' || status === 'connecting') base = translate('statusSending')
  else if (status === 'sent' || status === 'stored' || status === 'mailboxing' || status === 'sending_p2p') base = translate('statusSent')
  else if (status === 'waiting_peer') base = translate('waitingPeer')
  else if (status === 'delivered') base = translate('statusDelivered')
  else if (status === 'read') base = translate('statusRead')
  else if (status === 'failed') base = translate('statusFailed')
  else if (status === 'expired') base = translate('statusExpired')
  else if (status === 'cancelled') base = translate('cancelled')
  const routeBit =
    route === 'direct' ? translate('viaDirect') : route === 'server' ? translate('viaServer') : route === 'mixed' ? translate('viaMixed') : ''
  // Put how it was sent first so "direct · seen" is obvious on the bubble.
  if (routeBit && (status === 'sent' || status === 'stored' || status === 'delivered' || status === 'read' || status === 'waiting_peer')) {
    return `${routeBit} · ${base}`
  }
  return base
}

const STAGE_MEMORY_BYTES = 32 * 1024 * 1024

/** Encrypt once into a dedicated sync-temp blob used for the upload, then optionally keep a durable copy. */
type StageHooks = { cancelled?: () => boolean; onProgress?: (cipherBytes: number) => void }

async function stageCipher(fileId: string, file: File, userId: string, hooks: StageHooks = {}): Promise<{ meta: FileCipherMeta; body: Blob; stored: boolean; removed: string[]; cleanup?: () => Promise<void> }> {
  const check = () => {
    if (hooks.cancelled?.()) throw new DOMException('aborted', 'AbortError')
  }
  const enc = await createEncryptor(file.size)
  if (opfsAvailable() && userId) {
    const writer = await openWriter(userId, 'sync-temp', fileId).catch(() => null)
    if (writer) {
      try {
        let done = 0
        for await (const { part, final } of blobParts(file)) {
          check()
          const chunk = enc.push(part, final)
          await writer.write(chunk)
          done += chunk.byteLength
          hooks.onProgress?.(done)
        }
        await writer.close()
      } catch (err) {
        await writer.abort()
        throw err
      }
      const body = await openNamed(userId, 'sync-temp', fileId)
      if (body) {
        let stored = false
        let removed: string[] = []
        const sink = await beginCipherFile(fileId, file.size)
        if (sink) {
          try {
            const step = 4 * 1024 * 1024
            for (let offset = 0; offset < body.size; offset += step) {
              check()
              await sink.write(new Uint8Array(await body.slice(offset, Math.min(body.size, offset + step)).arrayBuffer()))
            }
            removed = await sink.finish(enc.meta)
            stored = true
          } catch {
            await sink.abort()
          }
        }
        return {
          meta: enc.meta,
          body,
          stored,
          removed,
          cleanup: () => removeNamed(userId, 'sync-temp', fileId),
        }
      }
    }
  }
  if (file.size > STAGE_MEMORY_BYTES) throw new Error('stage')
  const chunks: Uint8Array[] = []
  const mem = await createEncryptor(file.size)
  let done = 0
  for await (const { part, final } of blobParts(file)) {
    check()
    const chunk = mem.push(part, final)
    chunks.push(chunk)
    done += chunk.byteLength
    hooks.onProgress?.(done)
  }
  return { meta: mem.meta, body: new Blob(chunks as BlobPart[]), stored: false, removed: [] }
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
