import { api, apiOrigin } from '@ma/api-client'
import { b64, openBox, sealBox, unb64 } from '@ma/crypto'
import { envelopeSchema, newFrame, signalFrameSchema, type Envelope, type SignalFrame } from '@ma/protocol'
import { type OutboxPlain } from './db'
import { getIdentity, sealRow } from './vault'

type Handler = (frame: SignalFrame) => void

export class Transport {
  private ws: WebSocket | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private channels = new Map<string, RTCDataChannel>()
  private iceWait = new Map<string, RTCIceCandidateInit[]>()
  private handlers = new Set<Handler>()
  private stopped = false
  private reconnectTimer = 0
  private localUser = ''
  relayOnly = false
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
      this.emit({ v: 1, t: 'session.ready', id: 'local', p: {} })
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      this.status = 'offline'
      this.emit({ v: 1, t: 'session.closed', id: 'local', p: {} })
      if (!this.stopped) this.reconnectTimer = window.setTimeout(() => this.connect(), 1500)
    }
    ws.onmessage = (ev) => {
      const parsed = signalFrameSchema.safeParse(JSON.parse(String(ev.data)))
      if (!parsed.success) return
      const frame = parsed.data
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
    channel.send(payload)
    return true
  }

  sendFrame(frame: SignalFrame) {
    if (frame.t === 'chat.file.chunk' || 'data' in frame.p) return
    this.ws?.send(JSON.stringify(frame))
  }

  buffered() {
    return this.ws?.bufferedAmount ?? 0
  }

  private ice: { servers: RTCIceServer[]; until: number } | null = null

  private async iceServers() {
    if (this.ice && this.ice.until > Date.now()) return this.ice.servers
    const creds = await api<{ urls: string[]; username: string; credential: string }>('/v1/turn/credentials')
    const servers = [{ urls: creds.urls, username: creds.username, credential: creds.credential }]
    this.ice = { servers, until: Date.now() + 60 * 60 * 1000 }
    return servers
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
    channel.onopen = () => this.emit({ v: 1, t: 'p2p.open', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onclose = () => this.emit({ v: 1, t: 'p2p.close', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onerror = () => this.emit({ v: 1, t: 'p2p.error', id: 'local', from: this.peerFrom(key), p: {} })
    channel.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        this.emit({ v: 1, t: 'p2p.message', id: 'local', from: this.peerFrom(key), p: { data: ev.data } })
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

  async ensurePeer(userId: string, deviceId: string, timeoutMs = 4000) {
    const key = `${userId}:${deviceId}`
    const existing = this.channels.get(key)
    if (existing && existing.readyState === 'open') return existing
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
    return await new Promise<RTCDataChannel | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(channel.readyState === 'open' ? channel : null), timeoutMs)
      channel.onopen = () => {
        window.clearTimeout(timer)
        resolve(channel)
      }
    })
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

  async deliverText(row: OutboxPlain, recipientPk: string, deviceId = '') {
    row.recipientPk = recipientPk
    row.deviceId = deviceId
    row.state = 'queued'
    await sealRow('outbox', row.id, 'outbox', row)
    const id = getIdentity()
    const sealed = sealBox(new TextEncoder().encode(row.envelope), unb64(recipientPk), id.identityBox.privateKey)
    const wire: Envelope = { v: 1, alg: 'x25519-xchacha20poly1305', sender_identity_pk: id.identityBox.publicKey, nonce: sealed.nonce, ciphertext: sealed.ciphertext }
    let sent = false
    row.state = 'sending_p2p'
    if (deviceId) {
      const channel = await this.ensurePeer(row.recipientUserId, deviceId)
      if (channel && channel.readyState === 'open') {
        channel.send(JSON.stringify(wire))
        row.state = 'sent'
        sent = true
      }
    }
    if (!sent) {
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
    await sealRow('outbox', row.id, 'outbox', row)
    return wire
  }

  decryptEnvelope(envelope: Envelope) {
    const parsed = envelopeSchema.parse(envelope)
    const id = getIdentity()
    const opened = openBox(parsed.ciphertext, parsed.nonce, unb64(parsed.sender_identity_pk), id.identityBox.privateKey)
    return new TextDecoder().decode(opened)
  }
}

export const transport = new Transport()
