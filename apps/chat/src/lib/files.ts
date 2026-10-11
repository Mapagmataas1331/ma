import { b64, randomFileKey, ready, secretstreamHeader, secretstreamOverhead, secretstreamPull, secretstreamPullInit, secretstreamPush, unb64 } from '@ma/crypto'

/**
 * Plaintext bytes per secretstream chunk. On a data channel a chunk is split into several messages
 * when it is larger than the peer's maxMessageSize; the receiver reassembles it with `ChunkAssembler`.
 */
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

/**
 * True when `lengths` is exactly the plan `chunkLengths(size, chunk)` would produce. Then a peer can be told
 * just the chunk size instead of one number per chunk (65k numbers for a 4 GB file).
 */
export function isUniformPlan(lengths: number[], size: number, chunk = FILE_CHUNK_BYTES) {
  const plan = chunkLengths(size, chunk)
  if (plan.length !== lengths.length) return false
  for (let i = 0; i < plan.length; i += 1) if (plan[i] !== lengths[i]) return false
  return true
}

/**
 * Rebuilds ciphertext chunks from data-channel messages of any size. Each `push` returns the chunks
 * that are now complete, in order. Bytes past the last planned chunk are an error.
 */
export class ChunkAssembler {
  private index = 0
  private pending: Uint8Array[] = []
  private pendingBytes = 0

  constructor(private readonly lengths: readonly number[]) {}

  /** Number of whole chunks handed out so far. */
  get completed() {
    return this.index
  }

  /** True when every planned chunk arrived and nothing is left over. */
  get done() {
    return this.index === this.lengths.length && this.pendingBytes === 0
  }

  push(bytes: Uint8Array): Uint8Array[] {
    const out: Uint8Array[] = []
    if (bytes.byteLength) {
      this.pending.push(bytes)
      this.pendingBytes += bytes.byteLength
    }
    for (;;) {
      const want = this.lengths[this.index]
      if (want === undefined) {
        if (this.pendingBytes > 0) throw new Error('overflow')
        return out
      }
      if (this.pendingBytes < want) return out
      out.push(this.take(want))
      this.index += 1
    }
  }

  private take(length: number) {
    const first = this.pending[0]
    if (first && first.byteLength === length) {
      this.pending.shift()
      this.pendingBytes -= length
      return first
    }
    const chunk = new Uint8Array(length)
    let filled = 0
    while (filled < length) {
      const head = this.pending[0]
      if (!head) throw new Error('underflow')
      const need = length - filled
      if (head.byteLength <= need) {
        chunk.set(head, filled)
        filled += head.byteLength
        this.pending.shift()
      } else {
        chunk.set(head.subarray(0, need), filled)
        filled += need
        this.pending[0] = head.subarray(need)
      }
    }
    this.pendingBytes -= length
    return chunk
  }
}

/**
 * Collects plaintext parts and folds them into a Blob every few MiB, so a multi-gigabyte file does not
 * sit in the JS heap as one huge list of ArrayBuffers (browsers can page Blob data to disk).
 */
export class BlobCollector {
  private blobs: Blob[] = []
  private parts: Uint8Array[] = []
  private partBytes = 0
  size = 0

  constructor(private readonly foldBytes = 32 * 1024 * 1024) {}

  push(part: Uint8Array) {
    this.parts.push(part)
    this.partBytes += part.byteLength
    this.size += part.byteLength
    if (this.partBytes >= this.foldBytes) this.fold()
  }

  private fold() {
    if (!this.parts.length) return
    this.blobs.push(new Blob(this.parts as BlobPart[]))
    this.parts = []
    this.partBytes = 0
  }

  blob(type = '') {
    this.fold()
    const out = new Blob(this.blobs, { type })
    this.blobs = []
    return out
  }

  clear() {
    this.blobs = []
    this.parts = []
    this.partBytes = 0
    this.size = 0
  }
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

/** Decrypt a ciphertext blob into a plaintext Blob without holding every part in the JS heap. */
export async function decryptBlob(cipher: Blob, meta: FileCipherMeta, type = '') {
  await ready()
  const state = secretstreamPullInit(unb64(meta.header), unb64(meta.key))
  const out = new BlobCollector()
  let offset = 0
  for (const length of meta.lengths) {
    const chunk = new Uint8Array(await cipher.slice(offset, offset + length).arrayBuffer())
    const opened = secretstreamPull(state, chunk) as { message?: Uint8Array } | Uint8Array
    const message = opened instanceof Uint8Array ? opened : opened.message
    if (!message) throw new Error('decrypt')
    out.push(message)
    offset += length
  }
  return out.blob(type)
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
