import { describe, expect, it } from 'vitest'
import { Transport } from './transport'

type Listener = (ev: { data: unknown }) => void

/** Minimal data channel pair: what one side sends arrives at the other, and oversize sends throw like browsers do. */
function fakeChannel(limit: number) {
  const channel = {
    readyState: 'open',
    bufferedAmount: 0,
    binaryType: 'arraybuffer',
    onmessage: null as Listener | null,
    onopen: null,
    onclose: null,
    onerror: null,
    sent: [] as number[],
    send(data: string | Uint8Array) {
      const size = typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength
      if (size > limit) throw new TypeError(`RTCDataChannel.send: Message size (${size}) exceeds maxMessageSize`)
      channel.sent.push(size)
      channel.onmessage?.({ data: typeof data === 'string' ? data : data.slice().buffer })
    },
    addEventListener() {},
    removeEventListener() {},
  }
  return channel
}

describe('Transport message size', () => {
  it('fragments large text so no message exceeds maxMessageSize and reassembles it', () => {
    const transport = new Transport()
    const channel = fakeChannel(64 * 1024)
    const got: string[] = []
    transport.on((frame) => {
      if (frame.t === 'p2p.message') got.push(String(frame.p.data))
    })
    ;(transport as unknown as { bindChannel(key: string, ch: unknown): void }).bindChannel('u:d', channel)
    const big = JSON.stringify({ t: 'sync.records', messages: Array.from({ length: 4000 }, (_, i) => ({ id: `m${i}`, body: 'привет "quoted" \u0001 text' })) })
    transport.sendText(channel as unknown as RTCDataChannel, big)
    expect(Math.max(...channel.sent)).toBeLessThanOrEqual(64 * 1024)
    expect(channel.sent.length).toBeGreaterThan(1)
    expect(got).toEqual([big])
  })

  it('splits binary chunks above the limit', async () => {
    const transport = new Transport()
    const channel = fakeChannel(64 * 1024)
    const pieces: number[] = []
    transport.on((frame) => {
      if (frame.t === 'p2p.binary') pieces.push((frame.p.bytes as Uint8Array).byteLength)
    })
    ;(transport as unknown as { bindChannel(key: string, ch: unknown): void }).bindChannel('u:d', channel)
    await transport.sendBinary(channel as unknown as RTCDataChannel, new Uint8Array(65_553))
    expect(pieces).toEqual([65_536, 17])
  })
})
