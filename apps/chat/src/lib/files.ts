import { b64, randomFileKey, ready, secretstreamHeader, secretstreamOverhead, secretstreamPull, secretstreamPullInit, secretstreamPush, unb64 } from '@ma/crypto'

/** Plaintext bytes per secretstream chunk. Every chunk goes out as one data-channel message. */
export const FILE_CHUNK_BYTES = 64 * 1024

export type FileCipherMeta = { key: string; header: string; lengths: number[] }

/** Bytes the ciphertext will occupy, including the secretstream tag on every chunk. */
export function ciphertextSize(plainBytes: number) {
  return chunkLengths(plainBytes).reduce((sum, n) => sum + n, 0)
}

/** Ciphertext chunk sizes for a plaintext of `size` bytes. Deterministic, so both sides can compute it. */
export function chunkLengths(size: number, chunk = FILE_CHUNK_BYTES) {
  const overhead = secretstreamOverhead()
  const out: number[] = []
  if (size <= 0) return [overhead]
  for (let offset = 0; offset < size; offset += chunk) out.push(Math.min(chunk, size - offset) + overhead)
  return out
}

/** Key, header, and chunk plan are fixed before the first byte, so a `file.start` message can go out first. */
export async function createEncryptor(size: number) {
  await ready()
  const key = randomFileKey()
  const stream = secretstreamHeader(key)
  const meta: FileCipherMeta = { key: b64(key), header: b64(stream.header), lengths: chunkLengths(size) }
  return {
    meta,
    /** Encrypt one plaintext part. Parts must be fed in order and `final` set on the last one. */
    push: (part: Uint8Array, final: boolean) => secretstreamPush(stream.state, part, final),
  }
}

/** Yield plaintext slices of a blob in chunk order. Nothing larger than one chunk is held in memory. */
export async function* blobParts(file: Blob) {
  if (file.size === 0) {
    yield { part: new Uint8Array(0), final: true, index: 0 }
    return
  }
  let index = 0
  for (let offset = 0; offset < file.size; offset += FILE_CHUNK_BYTES) {
    const part = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + FILE_CHUNK_BYTES)).arrayBuffer())
    yield { part, final: offset + FILE_CHUNK_BYTES >= file.size, index }
    index += 1
  }
}

/**
 * Encrypt a blob chunk by chunk. `onChunk` receives each ciphertext chunk in order and may await
 * (write to disk, wait for a data channel to drain).
 */
export async function encryptStream(file: Blob, onChunk: (chunk: Uint8Array, index: number, total: number) => Promise<void> | void): Promise<FileCipherMeta> {
  const enc = await createEncryptor(file.size)
  const total = enc.meta.lengths.length
  for await (const { part, final, index } of blobParts(file)) {
    await onChunk(enc.push(part, final), index, total)
  }
  return enc.meta
}

/** Decrypt a ciphertext blob using the recorded chunk lengths. Plaintext parts stay as separate buffers. */
export async function decryptParts(cipher: Blob, meta: FileCipherMeta) {
  await ready()
  const state = secretstreamPullInit(unb64(meta.header), unb64(meta.key))
  const parts: Uint8Array[] = []
  let offset = 0
  for (const length of meta.lengths) {
    const chunk = new Uint8Array(await cipher.slice(offset, offset + length).arrayBuffer())
    const opened = secretstreamPull(state, chunk) as { message?: Uint8Array } | Uint8Array
    const message = opened instanceof Uint8Array ? opened : opened.message
    if (!message) throw new Error('decrypt')
    parts.push(message)
    offset += length
  }
  return parts
}

/** Incremental decryptor for chunks that arrive one data-channel message at a time. */
export async function pullDecryptor(meta: Pick<FileCipherMeta, 'key' | 'header'>) {
  await ready()
  const state = secretstreamPullInit(unb64(meta.header), unb64(meta.key))
  return (chunk: Uint8Array) => {
    const opened = secretstreamPull(state, chunk) as { message?: Uint8Array } | Uint8Array
    const message = opened instanceof Uint8Array ? opened : opened.message
    if (!message) throw new Error('decrypt')
    return message
  }
}
