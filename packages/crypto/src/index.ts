// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./libsodium.d.ts" />
import sodium from 'libsodium-wrappers-sumo'

export type KdfParams = { alg: 'argon2id'; mem: number; ops: number; salt: string }
export type WrappedSlot = { kind: 'password' | 'recovery'; wrapped_dek: string; nonce: string; kdf: KdfParams }
export type KeyPair = { publicKey: Uint8Array; privateKey: Uint8Array }

const text = new TextEncoder()
const textOut = new TextDecoder()

export async function ready() {
  await sodium.ready
  return sodium
}

export function b64(bytes: Uint8Array) {
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING)
}

export function unb64(value: string) {
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING)
}

export function randomBytes(n: number) {
  return sodium.randombytes_buf(n)
}

export function deriveKek(password: string, kdf: KdfParams) {
  return sodium.crypto_pwhash(
    32,
    password,
    unb64(kdf.salt),
    kdf.ops,
    kdf.mem,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
}

export function moderateKdf(): KdfParams {
  return {
    alg: 'argon2id',
    mem: sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    ops: sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    salt: b64(randomBytes(16)),
  }
}

export function interactiveKdf(): KdfParams {
  return {
    alg: 'argon2id',
    mem: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    ops: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    salt: b64(randomBytes(16)),
  }
}

function aeadEncrypt(key: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array) {
  const nonce = randomBytes(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
  const boxed = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad ?? null, null, nonce, key)
  return { nonce: b64(nonce), ciphertext: b64(boxed) }
}

function aeadDecrypt(key: Uint8Array, nonce: string, ciphertext: string, aad?: Uint8Array) {
  const opened = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, unb64(ciphertext), aad ?? null, unb64(nonce), key)
  return opened
}

export function wrapDek(kek: Uint8Array, dek: Uint8Array, kind: WrappedSlot['kind'], kdf: KdfParams): WrappedSlot {
  const wrapped = aeadEncrypt(kek, dek)
  return { kind, wrapped_dek: wrapped.ciphertext, nonce: wrapped.nonce, kdf }
}

export function unwrapDek(kek: Uint8Array, slot: WrappedSlot) {
  return aeadDecrypt(kek, slot.nonce, slot.wrapped_dek)
}

export function encryptRecord(dek: Uint8Array, recordId: string, table: string, plaintext: unknown) {
  const aad = text.encode(`${table}|${recordId}`)
  return aeadEncrypt(dek, text.encode(JSON.stringify(plaintext)), aad)
}

export function decryptRecord<T>(dek: Uint8Array, recordId: string, table: string, nonce: string, ciphertext: string): T {
  const aad = text.encode(`${table}|${recordId}`)
  const opened = aeadDecrypt(dek, nonce, ciphertext, aad)
  return JSON.parse(textOut.decode(opened)) as T
}

export function signKeyPair(): KeyPair {
  const kp = sodium.crypto_sign_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

export function boxKeyPair(): KeyPair {
  const kp = sodium.crypto_box_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

export function sealBox(message: Uint8Array, recipientPk: Uint8Array, senderSk: Uint8Array) {
  const nonce = randomBytes(sodium.crypto_box_NONCEBYTES)
  const boxed = sodium.crypto_box_easy(message, nonce, recipientPk, senderSk)
  return { nonce: b64(nonce), ciphertext: b64(boxed) }
}

export function openBox(ciphertext: string, nonce: string, senderPk: Uint8Array, recipientSk: Uint8Array) {
  return sodium.crypto_box_open_easy(unb64(ciphertext), unb64(nonce), senderPk, recipientSk)
}

export function pairingConfirm(code: string, pkA: Uint8Array, pkB: Uint8Array, pairingId: string) {
  const msg = text.encode(`${b64(pkA)}|${b64(pkB)}|${pairingId}`)
  const key = sodium.crypto_generichash(32, text.encode(code))
  return b64(sodium.crypto_auth(msg, key))
}

export function verifyPairing(tag: string, code: string, pkA: Uint8Array, pkB: Uint8Array, pairingId: string) {
  const msg = text.encode(`${b64(pkA)}|${b64(pkB)}|${pairingId}`)
  const key = sodium.crypto_generichash(32, text.encode(code))
  return sodium.crypto_auth_verify(unb64(tag), msg, key)
}

export function secretstreamHeader(key: Uint8Array) {
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
  return { state: state.state, header: state.header }
}

export function secretstreamPush(state: unknown, chunk: Uint8Array, final = false) {
  const tag = final ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
  return sodium.crypto_secretstream_xchacha20poly1305_push(state, chunk, null, tag)
}

export function secretstreamPullInit(header: Uint8Array, key: Uint8Array) {
  return sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key)
}

export function secretstreamPull(state: unknown, chunk: Uint8Array) {
  return sodium.crypto_secretstream_xchacha20poly1305_pull(state, chunk, null)
}

export function zero(bytes: Uint8Array | null | undefined) {
  if (bytes) sodium.memzero(bytes)
}

export function randomDek() {
  return randomBytes(32)
}

export function randomFileKey() {
  return randomBytes(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
}
