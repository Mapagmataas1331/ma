// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  boxKeyPair,
  decryptRecord,
  encryptRecord,
  interactiveKdf,
  openBox,
  pairingConfirm,
  randomDek,
  ready,
  sealBox,
  secretstreamHeader,
  secretstreamPull,
  secretstreamPullInit,
  secretstreamPush,
  unwrapDek,
  verifyPairing,
  wrapDek,
  deriveKek,
} from './index'

describe('vault key hierarchy', () => {
  it('wraps and unwraps a DEK and rejects a wrong password', async () => {
    await ready()
    const dek = randomDek()
    const kdf = interactiveKdf()
    const slot = wrapDek(deriveKek('correct horse', kdf), dek, 'password', kdf)
    const opened = unwrapDek(deriveKek('correct horse', kdf), slot)
    expect(Array.from(opened)).toEqual(Array.from(dek))
    expect(() => unwrapDek(deriveKek('wrong', kdf), slot)).toThrow()
  })

  it('detects a tampered record and a substituted pairing key', async () => {
    await ready()
    const dek = randomDek()
    const rec = encryptRecord(dek, '1', 'records', { body: 'hi' })
    expect(decryptRecord(dek, '1', 'records', rec.nonce, rec.ciphertext)).toEqual({ body: 'hi' })
    expect(() => decryptRecord(dek, '2', 'records', rec.nonce, rec.ciphertext)).toThrow()

    const a = boxKeyPair()
    const b = boxKeyPair()
    const tag = pairingConfirm('ABCD2345', a.publicKey, b.publicKey, 'pair')
    expect(verifyPairing(tag, 'ABCD2345', a.publicKey, b.publicKey, 'pair')).toBe(true)
    const other = boxKeyPair()
    expect(verifyPairing(tag, 'ABCD2345', a.publicKey, other.publicKey, 'pair')).toBe(false)

    const sealed = sealBox(new TextEncoder().encode('hello'), b.publicKey, a.privateKey)
    const opened = openBox(sealed.ciphertext, sealed.nonce, a.publicKey, b.privateKey)
    expect(new TextDecoder().decode(opened)).toBe('hello')

    const fileKey = randomDek().slice(0, 32)
    const push = secretstreamHeader(fileKey)
    const chunk = secretstreamPush(push.state, new TextEncoder().encode('abcdef'), true)
    const pullState = secretstreamPullInit(push.header, fileKey)
    const pulled = secretstreamPull(pullState, chunk)
    expect(new TextDecoder().decode(pulled.message)).toBe('abcdef')
  })
})
