import { api, apiOrigin } from '@ma/api-client'
import { b64, openBox, sealBox, unb64 } from '@ma/crypto'
import { envelopeSchema, newFrame, signalFrameSchema, type Envelope, type SignalFrame } from '@ma/protocol'
import { type OutboxPlain } from './db'
import { getIdentity, sealRow } from './vault'

type Handler = (frame: SignalFrame) => void

/** File-control frames queued while the socket reconnects are only worth sending this soon after. */
const BACKLOG_TTL = 15_000
const BACKLOG_MAX = 64
/** Used when the browser does not report the negotiated SCTP limit. RFC 8841's default when SDP omits it. */
const FALLBACK_MESSAGE_BYTES = 64 * 1024
/** Never send bigger messages than this even when the peer allows more: huge messages stall the SCTP queue. */
const MAX_SEND_MESSAGE_BYTES = 256 * 1024
/** Upper bound for one reassembled text message (a sync batch or a file.start with a long chunk list). */
const MAX_FRAGMENTED_BYTES = 64 * 1024 * 1024
const FRAG_PREFIX = '{"t":"frag",'

type Fragments = { parts: string[]; got: number; bytes: number; at: number }

export class Transport {
  private ws: WebSocket | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private channels = new Map<string, RTCDataChannel>()
  private channelPeer = new WeakMap<RTCDataChannel, RTCPeerConnection>()
  private fragments = new Map<string, Fragments>()
  private iceWait = new Map<string, RTCIceCandidateInit[]>()
  private connecting = new Map<string, Promise<RTCDataChannel | null>>()
  private liveWait = new Map<string, { ok: () => void; fail: (err: Error) => void }>()
  private handlers = new Set<Handler>()
  private stopped = false
  private reconnectTimer = 0
  private localUser = ''
  /** chat.file.* frames that tried to go out while the socket was not open. Flushed on open. */
  private backlog: { frame: SignalFrame; at: number }[] = []
  relayOnly = false
  /** When set, a message is handed to an open data channel and never stored in the mailbox. */
  directOnly = false
  status: 'offline' | 'connecting' | 'online' = 'offline'

  setLocalUser(userId: string) {
    this.localUser = userId
  }

  on(handler: Handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const origin = apiOrigin().replace(/^http/, 'ws')
    const ws = new WebSocket(`${origin}/v1/ws`)
    this.ws = ws
    this.status = 'connecting'
    ws.onopen = () => {
      this.status = 'online'
      this.flushBacklog(ws)
      this.emit({ v: 1, t: 'session.ready', id: 'local', p: {} })
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      this.status = 'offline'
      this.emit({ v: 1, t: 'session.closed', id: 'local', p: {} })
      if (!this.stopped) this.reconnectTimer = window.setTimeout(() => this.connect(), 1500)
    }
    ws.onmessage = (ev) => {
      let raw: unknown
      try {
        raw = JSON.parse(String(ev.data))
      } catch {
        return
      }
      const parsed = signalFrameSchema.safeParse(raw)
      if (!parsed.success) return
      const frame = parsed.data
      if (frame.t === 'chat.envelope.ok') {
        this.liveWait.get(frame.id)?.ok()
        this.liveWait.delete(frame.id)
      }
      if (frame.t === 'error') {
        const pending = this.liveWait.get(frame.id)
        if (pending) {
          pending.fail(new Error(String(frame.p.code ?? 'error')))
          this.liveWait.delete(frame.id)
        }
      }
      if (frame.t === 'rtc.offer') void this.answer(frame)
      if (frame.t === 'rtc.answer' || frame.t === 'rtc.ice') void this.applySignal(frame)
      this.emit(frame)
    }
  }

  disconnect() {
    this.stopped = true
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = 0
    this.ws?.close()
    this.ws = null
    this.backlog = []
    for (const peer of this.peers.values()) peer.close()
    this.peers.clear()
    this.channels.clear()
    this.iceWait.clear()
    this.status = 'offline'
  }

  private emit(frame: SignalFrame) {
    for (const handler of this.handlers) handler(frame)
  }

  sendToPeer(userId: string, deviceId: string, payload: string) {
    const channel = this.channels.get(`${userId}:${deviceId}`)
    if (!channel || channel.readyState !== 'open') return false
    try {
      this.sendText(channel, payload)
      return true
    } catch {
      return false
    }
  }

  /**
   * Largest message this channel may carry. Firefox and Chrome refuse anything above the peer's
   * `a=max-message-size` with "Message size exceeds maxMessageSize", so every send must stay below it.
   */
  maxMessageSize(channel: RTCDataChannel) {
    const reported = this.channelPeer.get(channel)?.sctp?.maxMessageSize
    const limit = typeof reported === 'number' && Number.isFinite(reported) && reported > 0 ? reported : FALLBACK_MESSAGE_BYTES
    return Math.min(limit, MAX_SEND_MESSAGE_BYTES)
  }

  /** Send a JSON text message of any length: anything over the channel limit goes out as numbered fragments. */
  sendText(channel: RTCDataChannel, text: string) {
    const limit = this.maxMessageSize(channel)
    // A UTF-16 unit is at most 3 UTF-8 bytes, so this length check is safe without encoding first.
    if (text.length * 3 <= limit) {
      channel.send(text)
      return
    }
    // JSON escaping can grow a character to 6 bytes ("\u0001"), so size fragments for the worst case.
    const step = Math.max(1024, Math.floor((limit - 256) / 6))
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const n = Math.ceil(text.length / step)
    for (let i = 0; i < n; i += 1) {
      channel.send(JSON.stringify({ t: 'frag', id, i, n, d: text.slice(i * step, (i + 1) * step) }))
    }
  }

  /** Send binary data, split into pieces no larger than the channel limit, waiting for the buffer to drain. */
  async sendBinary(channel: RTCDataChannel, bytes: Uint8Array, ready?: () => void) {
    const limit = this.maxMessageSize(channel)
    for (let offset = 0; offset < bytes.byteLength || offset === 0; offset += limit) {
      await Transport.drain(channel)
      ready?.()
      if (channel.readyState !== 'open') throw new Error('peer_closed')
      const piece = offset === 0 && bytes.byteLength <= limit ? bytes : bytes.subarray(offset, Math.min(bytes.byteLength, offset + limit))
      channel.send(piece as unknown as ArrayBufferView<ArrayBuffer>)
      if (bytes.byteLength === 0) break
    }
  }

  /** Reassemble fragments. Returns the whole text once every piece arrived, '' while waiting, or the input when it is not a fragment. */
  private unfragment(key: string, data: string) {
    if (!data.startsWith(FRAG_PREFIX)) return data
    let frag: { id?: unknown; i?: unknown; n?: unknown; d?: unknown }
    try {
      frag = JSON.parse(data) as typeof frag
    } catch {
      return ''
    }
    const { id, i, n, d } = frag
    if (typeof id !== 'string' || typeof i !== 'number' || typeof n !== 'number' || typeof d !== 'string' || i < 0 || i >= n || n > 100_000) return ''
    const now = Date.now()
    for (const [slot, value] of this.fragments) if (now - value.at > 60_000) this.fragments.delete(slot)
    const slot = `${key}|${id}`
    const entry = this.fragments.get(slot) ?? { parts: new Array<string>(n), got: 0, bytes: 0, at: now }
    if (entry.parts.length !== n) return ''
    if (entry.parts[i] === undefined) {
      entry.parts[i] = d
      entry.got += 1
      entry.bytes += d.length
    }
    entry.at = now
    if (entry.bytes > MAX_FRAGMENTED_BYTES) {
      this.fragments.delete(slot)
      return ''
    }
    if (entry.got < n) {
      this.fragments.set(slot, entry)
      return ''
    }
    this.fragments.delete(slot)
    return entry.parts.join('')
  }

  /** Send a signaling frame. Returns false when it could not go out now (file-control frames are queued for the reconnect). */
  sendFrame(frame: SignalFrame) {
    if (frame.t === 'chat.file.chunk' || 'data' in frame.p) return false
    const ws = this.ws
    // Sending on a CONNECTING socket throws InvalidStateError; on CLOSING/CLOSED it is silently lost.
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(frame))
        return true
      } catch {
        // fall through to the backlog
      }
    }
    if (!this.stopped && frame.t.startsWith('chat.file.')) {
      this.backlog.push({ frame, at: Date.now() })
      if (this.backlog.length > BACKLOG_MAX) this.backlog.shift()
    }
    return false
  }

  private flushBacklog(ws: WebSocket) {
    const now = Date.now()
    const queued = this.backlog
    this.backlog = []
    for (const { frame, at } of queued) {
      if (now - at > BACKLOG_TTL) continue
      try {
        ws.send(JSON.stringify(frame))
      } catch {
        return
      }
    }
  }

  buffered() {
    return this.ws?.bufferedAmount ?? 0
  }

  private ice: { servers: RTCIceServer[]; until: number } | null = null

  private async iceServers() {
    if (this.ice && this.ice.until > Date.now()) return this.ice.servers
    try {
      const creds = await api<{ urls: string[]; username: string; credential: string }>('/v1/turn/credentials')
      const servers: RTCIceServer[] = [{ urls: creds.urls, username: creds.username, credential: creds.credential }]
      this.ice = { servers, until: Date.now() + 60 * 60 * 1000 }
      return servers
    } catch {
      return [{ urls: 'stun:stun.cloudflare.com:3478' }]
    }
  }

  /** Resolve once the channel's send buffer has drained below the threshold. */
  static drain(channel: RTCDataChannel, threshold = 1024 * 1024) {
    if (channel.bufferedAmount <= threshold) return Promise.resolve()
    return new Promise<void>((resolve) => {
      channel.bufferedAmountLowThreshold = threshold
      const done = () => {
        channel.removeEventListener('bufferedamountlow', done)
        channel.removeEventListener('close', done)
        resolve()
      }
      channel.addEventListener('bufferedamountlow', done)
      channel.addEventListener('close', done)
    })
  }

  peerOpen(userId: string, deviceId: string) {
    const channel = this.channels.get(`${userId}:${deviceId}`)
    return !!channel && channel.readyState === 'open'
  }

  private peerFrom(key: string) {
    const [user, device] = key.split(':')
    return { user: user || '', device: device || '' }
  }

  private bindChannel(key: string, channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer'
    const pc = this.peers.get(key)
    if (pc) this.channelPeer.set(channel, pc)
    channel.onopen = () => this.emit({ v: 1, t: 'p2p.open', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onclose = () => this.emit({ v: 1, t: 'p2p.close', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onerror = () => this.emit({ v: 1, t: 'p2p.error', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const data = this.unfragment(key, ev.data)
        if (data) this.emit({ v: 1, t: 'p2p.message', id: 'local', from: this.peerFrom(key), p: { data } })
        return
      }
      const bytes = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : null
      if (bytes) this.emit({ v: 1, t: 'p2p.binary', id: 'local', from: this.peerFrom(key), p: { bytes } })
    }
    this.channels.set(key, channel)
  }

  private async flushIce(key: string, pc: RTCPeerConnection) {
    const queued = this.iceWait.get(key) ?? []
    this.iceWait.delete(key)
    for (const candidate of queued) await pc.addIceCandidate(candidate)
  }

  /** Round-trip time of an open connection to this user, in milliseconds. Empty when no channel is up yet. */
  async rtt(userId: string) {
    let best: number | null = null
    for (const [key, pc] of this.peers) {
      if (!key.startsWith(`${userId}:`)) continue
      const stats = await pc.getStats().catch(() => null)
      if (!stats) continue
      stats.forEach((report) => {
        const row = report as { type?: string; state?: string; currentRoundTripTime?: number }
        if (row.type === 'candidate-pair' && row.state === 'succeeded' && typeof row.currentRoundTripTime === 'number') {
          const ms = row.currentRoundTripTime * 1000
          if (best === null || ms < best) best = ms
        }
      })
    }
    return best
  }

  private waitOpen(key: string, timeoutMs: number) {
    const open = this.channels.get(key)
    if (open?.readyState === 'open') return Promise.resolve(open)
    return new Promise<RTCDataChannel | null>((resolve) => {
      const started = Date.now()
      const poll = window.setInterval(() => {
        const ch = this.channels.get(key)
        if (ch?.readyState === 'open') {
          window.clearInterval(poll)
          resolve(ch)
          return
        }
        const pc = this.peers.get(key)
        const dead = !pc || pc.connectionState === 'failed' || pc.connectionState === 'closed'
        if (dead || Date.now() - started >= timeoutMs) {
          window.clearInterval(poll)
          resolve(null)
        }
      }, 150)
    })
  }

  /** Start ICE early when presence says they are online, so the first message need not wait. */
  warmPeer(userId: string, deviceIds: string[]) {
    for (const deviceId of deviceIds) {
      if (!deviceId || this.peerOpen(userId, deviceId)) continue
      void this.ensurePeer(userId, deviceId, 12_000).catch(() => undefined)
    }
  }

  async ensurePeer(userId: string, deviceId: string, timeoutMs = 8000) {
    if (!userId || !deviceId) return null
    const key = `${userId}:${deviceId}`
    const existing = this.channels.get(key)
    if (existing?.readyState === 'open') return existing
    const inflight = this.connecting.get(key)
    if (inflight) return inflight
    const work = this.openPeer(userId, deviceId, timeoutMs).finally(() => {
      if (this.connecting.get(key) === work) this.connecting.delete(key)
    })
    this.connecting.set(key, work)
    return work
  }

  private async openPeer(userId: string, deviceId: string, timeoutMs: number) {
    const key = `${userId}:${deviceId}`
    const existing = this.channels.get(key)
    if (existing?.readyState === 'open') return existing
    const pcExisting = this.peers.get(key)
    if (pcExisting && pcExisting.signalingState !== 'closed' && pcExisting.connectionState !== 'failed') {
      return this.waitOpen(key, timeoutMs)
    }
    const pc = new RTCPeerConnection({
      iceServers: await this.iceServers(),
      iceTransportPolicy: this.relayOnly ? 'relay' : 'all',
    })
    this.peers.set(key, pc)
    const channel = pc.createDataChannel('ctrl')
    this.bindChannel(key, channel)
    pc.ondatachannel = (ev) => this.bindChannel(key, ev.channel)
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      this.sendFrame(newFrame('rtc.ice', { candidate: ev.candidate.toJSON() }, { user: userId, device: deviceId }))
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.sendFrame(newFrame('rtc.offer', { sdp: offer.sdp }, { user: userId, device: deviceId }))
    return this.waitOpen(key, timeoutMs)
  }

  private async answer(frame: SignalFrame) {
    const from = frame.from
    if (!from?.device) return
    const key = `${from.user}:${from.device}`
    const existing = this.peers.get(key)
    if (existing && existing.signalingState === 'have-local-offer') {
      if (this.localUser <= from.user) return
      await existing.setLocalDescription({ type: 'rollback' })
    }
    const pc = existing ?? new RTCPeerConnection({ iceServers: await this.iceServers(), iceTransportPolicy: this.relayOnly ? 'relay' : 'all' })
    this.peers.set(key, pc)
    pc.ondatachannel = (ev) => this.bindChannel(key, ev.channel)
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      this.sendFrame(newFrame('rtc.ice', { candidate: ev.candidate.toJSON() }, { user: from.user, device: from.device }))
    }
    await pc.setRemoteDescription({ type: 'offer', sdp: String(frame.p.sdp ?? '') })
    await this.flushIce(key, pc)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    this.sendFrame(newFrame('rtc.answer', { sdp: answer.sdp }, { user: from.user, device: from.device }))
  }

  private async applySignal(frame: SignalFrame) {
    const from = frame.from
    if (!from?.device) return
    const pc = this.peers.get(`${from.user}:${from.device}`)
    if (!pc) return
    if (frame.t === 'rtc.answer' && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription({ type: 'answer', sdp: String(frame.p.sdp ?? '') })
      await this.flushIce(`${from.user}:${from.device}`, pc)
    }
    if (frame.t === 'rtc.ice' && frame.p.candidate) {
      const candidate = frame.p.candidate as RTCIceCandidateInit
      if (!pc.remoteDescription) {
        const queued = this.iceWait.get(`${from.user}:${from.device}`) ?? []
        queued.push(candidate)
        this.iceWait.set(`${from.user}:${from.device}`, queued)
        return
      }
      await pc.addIceCandidate(candidate)
    }
    if (frame.t === 'rtc.bye') {
      pc.close()
      this.peers.delete(`${from.user}:${from.device}`)
      this.channels.delete(`${from.user}:${from.device}`)
    }
  }

  async deliverText(row: OutboxPlain, recipientPk: string, deviceId = '', extraIds: string[] = [], online = false): Promise<'direct' | 'server'> {
    row.recipientPk = recipientPk
    row.deviceId = deviceId
    row.state = 'queued'
    await sealRow('outbox', row.id, 'outbox', row)
    const id = getIdentity()
    const sealed = sealBox(new TextEncoder().encode(row.envelope), unb64(recipientPk), id.identityBox.privateKey)
    const wire: Envelope = { v: 1, alg: 'x25519-xchacha20poly1305', sender_identity_pk: id.identityBox.publicKey, nonce: sealed.nonce, ciphertext: sealed.ciphertext }
    const deviceIds = [...new Set([deviceId, ...extraIds].filter(Boolean))]
    const peerOnline = online || deviceIds.length > 0 || row.recipientUserId === this.localUser
    let via: 'direct' | 'server' = 'server'
    row.state = 'sending_p2p'
    for (const peerDevice of deviceIds) {
      if (!this.peerOpen(row.recipientUserId, peerDevice)) continue
      const channel = this.channels.get(`${row.recipientUserId}:${peerDevice}`)
      if (!channel) continue
      this.sendText(channel, JSON.stringify(wire))
      row.state = 'sent'
      row.deviceId = peerDevice
      via = 'direct'
      break
    }
    // Live websocket delivery while they are online: encrypted, not stored in the mailbox.
    // Coturn is often down, so waiting for WebRTC first would make every chat look "via server".
    if (via === 'server' && peerOnline) {
      const live = await this.deliverLive(wire, row.recipientUserId, deviceIds[0] || '')
      if (live) {
        row.state = 'sent'
        via = 'direct'
      }
    }
    if (via === 'server' && deviceIds.length) {
      const opened = await Promise.any(
        deviceIds.map(async (peerDevice) => {
          const channel = await this.ensurePeer(row.recipientUserId, peerDevice, 2500)
          if (!channel || channel.readyState !== 'open') throw new Error('closed')
          return { channel, peerDevice }
        }),
      ).catch(() => null)
      if (opened) {
        this.sendText(opened.channel, JSON.stringify(wire))
        row.state = 'sent'
        row.deviceId = opened.peerDevice
        via = 'direct'
      }
    }
    if (via === 'server') {
      if (this.directOnly && row.recipientUserId !== this.localUser) {
        row.state = 'waiting_peer'
        await sealRow('outbox', row.id, 'outbox', row)
        throw new Error('direct_only')
      }
      if (this.directOnly) {
        row.state = 'sent'
        via = 'direct'
      } else {
        row.state = 'mailboxing'
        await api('/v1/mailbox/messages', {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: row.conversationId,
            recipient_user_id: row.recipientUserId,
            message_id: row.id,
            envelope: b64(new TextEncoder().encode(JSON.stringify(wire))),
          }),
        })
        row.state = 'stored'
      }
    } else if (!this.directOnly && row.recipientUserId !== this.localUser) {
      // Best-effort mailbox copy after live/P2P so a suspended iOS Home Screen still gets Web Push
      // and can drain if the live frame was dropped while JavaScript was frozen.
      try {
        await api('/v1/mailbox/messages', {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: row.conversationId,
            recipient_user_id: row.recipientUserId,
            message_id: row.id,
            envelope: b64(new TextEncoder().encode(JSON.stringify(wire))),
          }),
        })
      } catch {
        /* live already delivered */
      }
    }
    await sealRow('outbox', row.id, 'outbox', row)
    return via
  }

  private deliverLive(wire: Envelope, recipientUserId: string, deviceId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.resolve(false)
    const frame = newFrame('chat.envelope', { envelope: wire }, deviceId ? { user: recipientUserId, device: deviceId } : { user: recipientUserId })
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        this.liveWait.delete(frame.id)
        resolve(false)
      }, 2500)
      this.liveWait.set(frame.id, {
        ok: () => {
          window.clearTimeout(timer)
          resolve(true)
        },
        fail: () => {
          window.clearTimeout(timer)
          resolve(false)
        },
      })
      this.sendFrame(frame)
    })
  }

  decryptEnvelope(envelope: Envelope) {
    const parsed = envelopeSchema.parse(envelope)
    const id = getIdentity()
    const opened = openBox(parsed.ciphertext, parsed.nonce, unb64(parsed.sender_identity_pk), id.identityBox.privateKey)
    return new TextDecoder().decode(opened)
  }
}

export const transport = new Transport()
