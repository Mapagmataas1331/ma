import { b64, randomFileKey, ready, secretstreamHeader, secretstreamPull, secretstreamPullInit, secretstreamPush, unb64 } from '@ma/crypto'
import { activeUserId } from './db'
import { writeNamed } from './opfs'

export async function encryptFile(file: Blob) {
  await ready()
  const key = randomFileKey()
  const stream = secretstreamHeader(key)
  const chunks: Uint8Array[] = []
  const size = 64 * 1024
  for (let offset = 0; offset < file.size; offset += size) {
    const part = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + size)).arrayBuffer())
    const final = offset + size >= file.size
    chunks.push(secretstreamPush(stream.state, part, final))
  }
  const body = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let cursor = 0
  for (const chunk of chunks) {
    body.set(chunk, cursor)
    cursor += chunk.length
  }
  const userId = activeUserId()
  if (userId) await writeNamed(userId, file.size > 26_214_400 ? 'pending' : 'attachments', `${crypto.randomUUID()}.bin`, body).catch(() => undefined)
  return {
    bytes: body,
    key: b64(key),
    header: b64(stream.header),
    lengths: chunks.map((chunk) => chunk.length),
    alg: 'secretstream' as const,
  }
}

export async function decryptFile(bytes: Uint8Array, key: string, header: string, lengths: number[]) {
  await ready()
  const state = secretstreamPullInit(unb64(header), unb64(key))
  const parts: Uint8Array[] = []
  let offset = 0
  for (const length of lengths) {
    const opened = secretstreamPull(state, bytes.subarray(offset, offset + length)) as { message?: Uint8Array } | Uint8Array
    const message = opened instanceof Uint8Array ? opened : opened.message
    if (!message) throw new Error('decrypt')
    parts.push(message)
    offset += length
  }
  const body = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let cursor = 0
  for (const part of parts) {
    body.set(part, cursor)
    cursor += part.length
  }
  return body
}
