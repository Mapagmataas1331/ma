import { api, apiOrigin } from '@ma/api-client'
import { b64, openBox, sealBox, unb64 } from '@ma/crypto'
import { newFrame, signalFrameSchema, type Envelope, type SignalFrame } from '@ma/protocol'
import { type OutboxPlain } from './db'
import { sealRow } from './vault'
import { getIdentity } from './vault'

type Handler = (frame: SignalFrame) => void

export class Transport {
  private ws: WebSocket | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private channels = new Map<string, RTCDataChannel>()
  private handlers = new Set<Handler>()
  relayOnly = false

  on(handler: Handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  connect() {
    const origin = apiOrigin().replace(/^http/, 'ws')
    this.ws = new WebSocket(`${origin}/v1/ws`)
    this.ws.onmessage = (ev) => {
      const frame = signalFrameSchema.parse(JSON.parse(String(ev.data)))
      if (frame.t === 'rtc.offer') void this.answer(frame)
      if (frame.t === 'rtc.answer' || frame.t === 'rtc.ice') void this.applySignal(frame)
      for (const handler of this.handlers) handler(frame)
    }
  }

  sendFrame(frame: SignalFrame) {
    this.ws?.send(JSON.stringify(frame))
  }

  private async iceServers() {
    const creds = await api<{ urls: string[]; username: string; credential: string }>('/v1/turn/credentials')
    return [{ urls: creds.urls, username: creds.username, credential: creds.credential }]
  }

  async ensurePeer(userId: string, deviceId: string) {
    const key = `${userId}:${deviceId}`
    const existing = this.channels.get(key)
    if (existing && existing.readyState === 'open') return existing
    const pc = new RTCPeerConnection({
      iceServers: await this.iceServers(),
      iceTransportPolicy: this.relayOnly ? 'relay' : 'all',
    })
    this.peers.set(key, pc)
    const channel = pc.createDataChannel('ctrl')
    this.channels.set(key, channel)
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      this.sendFrame(newFrame('rtc.ice', { candidate: ev.candidate.toJSON() }, { user: userId, device: deviceId }))
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.sendFrame(newFrame('rtc.offer', { sdp: offer.sdp }, { user: userId, device: deviceId }))
    return channel
  }

  private async answer(frame: SignalFrame) {
    const from = frame.from
    if (!from) return
    const key = `${from.user}:${from.device}`
    const pc = new RTCPeerConnection({ iceServers: await this.iceServers(), iceTransportPolicy: this.relayOnly ? 'relay' : 'all' })
    this.peers.set(key, pc)
    pc.ondatachannel = (ev) => this.channels.set(key, ev.channel)
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      this.sendFrame(newFrame('rtc.ice', { candidate: ev.candidate.toJSON() }, { user: from.user, device: from.device }))
    }
    await pc.setRemoteDescription({ type: 'offer', sdp: String(frame.p.sdp ?? '') })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    this.sendFrame(newFrame('rtc.answer', { sdp: answer.sdp }, { user: from.user, device: from.device }))
  }

  private async applySignal(frame: SignalFrame) {
    const from = frame.from
    if (!from) return
    const pc = this.peers.get(`${from.user}:${from.device}`)
    if (!pc) return
    if (frame.t === 'rtc.answer') await pc.setRemoteDescription({ type: 'answer', sdp: String(frame.p.sdp ?? '') })
    if (frame.t === 'rtc.ice' && frame.p.candidate) await pc.addIceCandidate(frame.p.candidate as RTCIceCandidateInit)
  }

  async deliverText(row: OutboxPlain, recipientPk: string) {
    const id = getIdentity()
    const sealed = sealBox(new TextEncoder().encode(row.envelope), unb64(recipientPk), id.identityBox.privateKey)
    const wire: Envelope = { v: 1, alg: 'x25519-xchacha20poly1305', sender_identity_pk: id.identityBox.publicKey, nonce: sealed.nonce, ciphertext: sealed.ciphertext }
    const channel = this.channels.get(`${row.recipientUserId}:`)
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(wire))
      row.state = 'sent'
    } else {
      await api('/v1/mailbox/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: row.conversationId,
          recipient_user_id: row.recipientUserId,
          message_id: row.id,
          envelope: b64(new TextEncoder().encode(JSON.stringify(wire))),
        }),
      })
      row.state = 'sent'
    }
    await sealRow('outbox', row.id, 'outbox', row)
    return wire
  }

  decryptEnvelope(envelope: Envelope) {
    const id = getIdentity()
    const opened = openBox(envelope.ciphertext, envelope.nonce, unb64(envelope.sender_identity_pk), id.identityBox.privateKey)
    return new TextDecoder().decode(opened)
  }
}

export const transport = new Transport()
