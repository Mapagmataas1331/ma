// @vitest-environment node
import { ready } from '@ma/crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { blobParts, ChunkAssembler, chunkLengths, createEncryptor, decryptBlob, FILE_CHUNK_BYTES, isUniformPlan, pullDecryptor } from './files'

beforeAll(async () => {
  await ready()
})

function bytes(length: number, seed = 1) {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i += 1) out[i] = (i * 31 + seed) & 0xff
  return out
}

describe('direct transfer chunk plan', () => {
  it('describes a 4 GiB file with a single chunk size instead of a per-chunk list', () => {
    const size = 4 * 1024 ** 3 + 123
    const plan = chunkLengths(size)
    expect(plan).toHaveLength(Math.ceil(size / FILE_CHUNK_BYTES))
    expect(isUniformPlan(plan, size)).toBe(true)
    // The old file.start carried this list as JSON: far above any data channel's maxMessageSize.
    expect(JSON.stringify(plan).length).toBeGreaterThan(256 * 1024)
    expect(plan.reduce((sum, n) => sum + n, 0)).toBeGreaterThan(2 ** 32)
  })

  it('rejects a plan that differs from the standard one', () => {
    const plan = chunkLengths(200_000)
    plan[1] = (plan[1] ?? 0) - 1
    expect(isUniformPlan(plan, 200_000)).toBe(false)
  })
})

describe('ChunkAssembler', () => {
  it('rebuilds chunks from messages split at any size', () => {
    const lengths = [5, 3, 4]
    const all = bytes(12)
    const asm = new ChunkAssembler(lengths)
    const got: Uint8Array[] = []
    for (const piece of [all.subarray(0, 2), all.subarray(2, 7), all.subarray(7, 8), all.subarray(8, 12)]) got.push(...asm.push(piece))
    expect(got.map((c) => c.byteLength)).toEqual(lengths)
    expect(Array.from(got[1] ?? [])).toEqual(Array.from(all.subarray(5, 8)))
    expect(asm.done).toBe(true)
  })

  it('passes whole chunks through unchanged and reports a short stream', () => {
    const asm = new ChunkAssembler([4, 4])
    expect(asm.push(bytes(4))).toHaveLength(1)
    expect(asm.done).toBe(false)
  })

  it('throws on bytes beyond the plan', () => {
    const asm = new ChunkAssembler([2])
    expect(() => asm.push(bytes(3))).toThrow('overflow')
  })
})

describe('encrypted file round trip with split messages', () => {
  it('decrypts a multi-chunk file sent in 16 KiB pieces', async () => {
    const plain = new Blob([bytes(FILE_CHUNK_BYTES * 2 + 1000, 7)])
    const enc = await createEncryptor(plain.size)
    const cipher: Uint8Array[] = []
    for await (const { part, final } of blobParts(plain)) cipher.push(enc.push(part, final))
    const decrypt = await pullDecryptor(enc.meta)
    const asm = new ChunkAssembler(enc.meta.lengths)
    const out: Uint8Array[] = []
    for (const chunk of cipher) {
      for (let offset = 0; offset < chunk.byteLength; offset += 16 * 1024) {
        for (const whole of asm.push(chunk.subarray(offset, offset + 16 * 1024))) out.push(decrypt(whole))
      }
    }
    expect(asm.done).toBe(true)
    const joined = new Uint8Array(await new Blob(out as BlobPart[]).arrayBuffer())
    expect(Array.from(joined)).toEqual(Array.from(new Uint8Array(await plain.arrayBuffer())))
    const viaBlob = await decryptBlob(new Blob(cipher as BlobPart[]), enc.meta)
    expect(viaBlob.size).toBe(plain.size)
  })
})
