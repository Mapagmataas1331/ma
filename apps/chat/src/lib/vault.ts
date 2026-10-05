import {
  b64,
  boxKeyPair,
  decryptRecord,
  deriveKek,
  encryptRecord,
  interactiveKdf,
  kekFromPrf,
  randomBytes,
  randomDek,
  ready,
  signKeyPair,
  unb64,
  unwrapDek,
  wrapDek,
  wrapDekWebAuthn,
  zero,
  type WrappedSlot,
} from '@ma/crypto'
import { accountKey, activeDatabase, activeUserId } from './db'
import { decryptParts, encryptStream, type FileCipherMeta } from './files'
import { listNamed, openNamed, openWriter, opfsAvailable, removeKind, removeNamed } from './opfs'
import { createPrfCredential, evaluatePrf, platformAuthenticatorAvailable } from './webauthn'

type Secrets = {
  dek: Uint8Array
  identitySign: { publicKey: string; privateKey: Uint8Array }
  identityBox: { publicKey: string; privateKey: Uint8Array }
}

let secrets: Secrets | null = null
let lockTimer: number | undefined

export function isUnlocked() {
  return secrets !== null
}

export function getDek() {
  if (!secrets) throw new Error('locked')
  return secrets.dek
}

export function getIdentity() {
  if (!secrets) throw new Error('locked')
  return secrets
}

export function lockVault() {
  if (secrets) {
    zero(secrets.dek)
    zero(secrets.identitySign.privateKey)
    zero(secrets.identityBox.privateKey)
  }
  secrets = null
  if (lockTimer) window.clearTimeout(lockTimer)
  lockTimer = 0
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ma-vault-lock'))
}

function armLock(minutes = 15) {
  if (lockTimer) window.clearTimeout(lockTimer)
  lockTimer = window.setTimeout(lockVault, minutes * 60_000)
}

/** Keep the idle lock timer alive while the user is active with the vault open. */
export function touchVault() {
  if (secrets) armLock()
}

async function readSlots() {
  const row = await activeDatabase().vault.get('main')
  return (row?.slots ?? []) as WrappedSlot[]
}

export async function hasVault() {
  return Boolean(await activeDatabase().vault.get('main'))
}

export async function createVault(password: string) {
  await ready()
  const dek = randomDek()
  const kdf = interactiveKdf()
  const slot = wrapDek(deriveKek(password, kdf), dek, 'password', kdf)
  const sign = signKeyPair()
  const box = boxKeyPair()
  const keys = {
    signPk: b64(sign.publicKey),
    signSk: b64(sign.privateKey),
    boxPk: b64(box.publicKey),
    boxSk: b64(box.privateKey),
  }
  const rec = encryptRecord(dek, 'identity', 'keys', keys)
  await activeDatabase().vault.put({ id: 'main', version: 1, ownerUserId: activeUserId(), slots: [slot], createdAt: new Date().toISOString() })
  await activeDatabase().records.put({ id: 'identity', nonce: rec.nonce, ciphertext: rec.ciphertext })
  secrets = {
    dek,
    identitySign: { publicKey: keys.signPk, privateKey: sign.privateKey },
    identityBox: { publicKey: keys.boxPk, privateKey: box.privateKey },
  }
  armLock()
  return { ed25519: keys.signPk, x25519: keys.boxPk }
}

export async function importTransferredIdentity(password: string, payload: { dek: string; signPk: string; signSk: string; boxPk: string; boxSk: string }) {
  await ready()
  const dek = unb64(payload.dek)
  const kdf = interactiveKdf()
  const slot = wrapDek(deriveKek(password, kdf), dek, 'password', kdf)
  const keys = { signPk: payload.signPk, signSk: payload.signSk, boxPk: payload.boxPk, boxSk: payload.boxSk }
  const rec = encryptRecord(dek, 'identity', 'keys', keys)
  await activeDatabase().vault.put({ id: 'main', version: 1, ownerUserId: activeUserId(), slots: [slot], createdAt: new Date().toISOString() })
  await activeDatabase().records.put({ id: 'identity', nonce: rec.nonce, ciphertext: rec.ciphertext })
  secrets = {
    dek,
    identitySign: { publicKey: payload.signPk, privateKey: unb64(payload.signSk) },
    identityBox: { publicKey: payload.boxPk, privateKey: unb64(payload.boxSk) },
  }
  armLock()
}

export async function vaultOwner() {
  const row = await activeDatabase().vault.get('main')
  return row?.ownerUserId || ''
}

export async function unlockVault(password: string) {
  await ready()
  const slots = await readSlots()
  const passwordSlot = slots.find((s): s is Extract<WrappedSlot, { kind: 'password' }> => s.kind === 'password')
  const recoverySlot = slots.find((s): s is Extract<WrappedSlot, { kind: 'recovery' }> => s.kind === 'recovery')
  let dek: Uint8Array | null = null
  if (passwordSlot) {
    try {
      dek = unwrapDek(deriveKek(password, passwordSlot.kdf), passwordSlot)
    } catch {
      dek = null
    }
  }
  if (!dek && recoverySlot) {
    try {
      dek = unwrapDek(deriveKek(password, recoverySlot.kdf), recoverySlot)
    } catch {
      dek = null
    }
  }
  if (!dek) throw new Error('wrong_password')
  await openWithDek(dek)
}

async function openWithDek(dek: Uint8Array) {
  const owner = await vaultOwner()
  if (owner && owner !== activeUserId()) throw new Error('vault_owner')
  const row = await activeDatabase().records.get('identity')
  if (!row) throw new Error('missing identity')
  const keys = decryptRecord<{ signPk: string; signSk: string; boxPk: string; boxSk: string }>(dek, 'identity', 'keys', row.nonce, row.ciphertext)
  secrets = {
    dek,
    identitySign: { publicKey: keys.signPk, privateKey: unb64(keys.signSk) },
    identityBox: { publicKey: keys.boxPk, privateKey: unb64(keys.boxSk) },
  }
  armLock()
}

export async function hasWebAuthnUnlock() {
  const slots = await readSlots()
  return slots.some((s) => s.kind === 'webauthn')
}

export async function webAuthnUnlockAvailable() {
  return platformAuthenticatorAvailable()
}

export async function unlockVaultWithWebAuthn(signal?: AbortSignal) {
  await ready()
  const slots = await readSlots()
  const slot = slots.find((s) => s.kind === 'webauthn')
  if (!slot || slot.kind !== 'webauthn') throw new Error('no_webauthn')
  const prf = await evaluatePrf(slot.credentialId, unb64(slot.prfSalt), signal)
  if (!prf) throw new Error('webauthn_prf_unsupported')
  const kek = kekFromPrf(prf)
  try {
    const dek = unwrapDek(kek, slot)
    await openWithDek(dek)
  } finally {
    zero(kek)
    zero(prf)
  }
}

/** Register a device passkey as an extra unlock path. Vault must already be unlocked. */
export async function enableWebAuthnUnlock(opts: { userName: string; displayName: string }) {
  await ready()
  if (!secrets) throw new Error('locked')
  if (!(await platformAuthenticatorAvailable())) throw new Error('webauthn_unavailable')
  const prfSalt = randomBytes(32)
  const { credentialId, prf } = await createPrfCredential({
    userId: activeUserId() || 'local',
    userName: opts.userName,
    displayName: opts.displayName,
    prfSalt,
  })
  const kek = kekFromPrf(prf)
  try {
    const slot = wrapDekWebAuthn(kek, secrets.dek, credentialId, b64(prfSalt))
    const slots = await readSlots()
    await activeDatabase().vault.update('main', { slots: [...slots.filter((s) => s.kind !== 'webauthn'), slot] })
  } finally {
    zero(kek)
    zero(prf)
  }
}

export async function disableWebAuthnUnlock() {
  const slots = await readSlots()
  if (!slots.some((s) => s.kind === 'webauthn')) return
  await activeDatabase().vault.update('main', { slots: slots.filter((s) => s.kind !== 'webauthn') })
}

export async function changeVaultPassword(current: string, next: string) {
  await ready()
  const slots = await readSlots()
  const slot = slots.find((s) => s.kind === 'password')
  if (!slot || slot.kind !== 'password') throw new Error('no vault')
  const dek = unwrapDek(deriveKek(current, slot.kdf), slot)
  const kdf = interactiveKdf()
  const wrapped = wrapDek(deriveKek(next, kdf), dek, 'password', kdf)
  const others = slots.filter((s) => s.kind !== 'password')
  await activeDatabase().vault.update('main', { slots: [wrapped, ...others] })
  zero(dek)
}

export async function addRecoverySlot() {
  await ready()
  if (!secrets) throw new Error('locked')
  const recovery = b64(randomDek())
  const kdf = interactiveKdf()
  const slot = wrapDek(deriveKek(recovery, kdf), secrets.dek, 'recovery', kdf)
  const slots = await readSlots()
  await activeDatabase().vault.update('main', { slots: [...slots.filter((s) => s.kind !== 'recovery'), slot] })
  return recovery
}

export async function sealRow(table: 'records' | 'outbox', id: string, kind: string, value: unknown) {
  const rec = encryptRecord(getDek(), id, kind, value)
  await activeDatabase()[table].put({ id, nonce: rec.nonce, ciphertext: rec.ciphertext })
}

export async function openRow<T>(table: 'records' | 'outbox', id: string, kind: string): Promise<T | undefined> {
  const row = await activeDatabase()[table].get(id)
  if (!row) return undefined
  return decryptRecord<T>(getDek(), id, kind, row.nonce, row.ciphertext)
}

export async function loadHistory(): Promise<{ id: string; conversationId: string; body: string; mine: boolean; at: string; status: string }[]> {
  const rows = await activeDatabase().records.toArray()
  const out: { id: string; conversationId: string; body: string; mine: boolean; at: string; status: string }[] = []
  for (const row of rows) {
    if (row.id === 'identity') continue
    try {
      out.push(decryptRecord(getDek(), row.id, 'messages', row.nonce, row.ciphertext))
    } catch {
      continue
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** Default budget for everything this account keeps on this device: chats, cached files, files waiting to be sent. */
export const DEFAULT_STORAGE_GB = 5
/** Blobs up to this size may fall back to IndexedDB when OPFS is unavailable. */
const IDB_FALLBACK_BYTES = 32 * 1024 * 1024

type StoredMeta = { data?: string; opfs?: boolean; key?: string; header?: string; lengths?: number[] }

export function storageLimitBytes() {
  const raw = localStorage.getItem(accountKey(activeUserId(), 'storageGb'))
  if (raw === null || raw === '') return DEFAULT_STORAGE_GB * 1024 * 1024 * 1024
  const gb = Number(raw)
  if (!Number.isFinite(gb) || gb < 0) return DEFAULT_STORAGE_GB * 1024 * 1024 * 1024
  if (gb === 0) return Number.POSITIVE_INFINITY
  return gb * 1024 * 1024 * 1024
}

/** True when a file of this size fits inside the budget at all. */
export function fitsBudget(size: number) {
  const limit = storageLimitBytes()
  return !Number.isFinite(limit) || size <= limit
}

function opfsName(id: string) {
  return `${id}.bin`
}

async function putFileRow(id: string, size: number, meta: StoredMeta) {
  const rec = encryptRecord(getDek(), id, 'files', meta)
  await activeDatabase().files.put({ id, size, savedAt: Date.now(), nonce: rec.nonce, ciphertext: rec.ciphertext })
}

function readMeta(id: string, row: { nonce: string; ciphertext: string }) {
  try {
    return decryptRecord<StoredMeta>(getDek(), id, 'files', row.nonce, row.ciphertext)
  } catch {
    return undefined
  }
}

/** Keep plaintext for later viewing or re-sending. Encrypted chunk by chunk into OPFS; small blobs may fall back to IndexedDB. */
export async function keepFile(id: string, blob: Blob): Promise<{ kept: boolean; removed: string[] }> {
  if (!fitsBudget(blob.size)) return { kept: false, removed: [] }
  const userId = activeUserId()
  if (opfsAvailable() && userId) {
    const writer = await openWriter(userId, 'files', opfsName(id)).catch(() => null)
    if (writer) {
      try {
        const meta = await encryptStream(blob, (chunk) => writer.write(chunk))
        await writer.close()
        await putFileRow(id, blob.size, { opfs: true, ...meta })
        return { kept: true, removed: await enforceStorageLimit() }
      } catch {
        await writer.abort()
      }
    }
  }
  if (blob.size > IDB_FALLBACK_BYTES) return { kept: false, removed: [] }
  await putFileRow(id, blob.size, { data: b64(new Uint8Array(await blob.arrayBuffer())) })
  return { kept: true, removed: await enforceStorageLimit() }
}

/** Keep ciphertext exactly as it arrived, together with its key. No re-encryption. */
export async function keepCipher(id: string, cipher: Blob, meta: FileCipherMeta, size: number): Promise<{ kept: boolean; removed: string[] }> {
  if (!fitsBudget(size)) return { kept: false, removed: [] }
  const userId = activeUserId()
  if (opfsAvailable() && userId) {
    const writer = await openWriter(userId, 'files', opfsName(id)).catch(() => null)
    if (writer) {
      try {
        const step = 4 * 1024 * 1024
        for (let offset = 0; offset < cipher.size; offset += step) {
          await writer.write(new Uint8Array(await cipher.slice(offset, Math.min(cipher.size, offset + step)).arrayBuffer()))
        }
        await writer.close()
        await putFileRow(id, size, { opfs: true, ...meta })
        return { kept: true, removed: await enforceStorageLimit() }
      } catch {
        await writer.abort()
      }
    }
  }
  if (size > IDB_FALLBACK_BYTES) return { kept: false, removed: [] }
  const parts = await decryptParts(cipher, meta)
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let cursor = 0
  for (const part of parts) {
    bytes.set(part, cursor)
    cursor += part.length
  }
  await putFileRow(id, size, { data: b64(bytes) })
  return { kept: true, removed: await enforceStorageLimit() }
}

/** Streaming sink for ciphertext chunks as they arrive from a peer. Returns null when nothing can be kept. */
export async function beginCipherFile(id: string, size: number) {
  const userId = activeUserId()
  if (!fitsBudget(size) || !opfsAvailable() || !userId) return null
  const writer = await openWriter(userId, 'files', opfsName(id)).catch(() => null)
  if (!writer) return null
  return {
    write: (chunk: Uint8Array) => writer.write(chunk),
    finish: async (meta: FileCipherMeta) => {
      await writer.close()
      await putFileRow(id, size, { opfs: true, ...meta })
      return enforceStorageLimit()
    },
    abort: () => writer.abort(),
  }
}

export type StoredFile = { kind: 'opfs'; meta: FileCipherMeta; cipher: File; size: number } | { kind: 'bytes'; bytes: Uint8Array; size: number }

/** Open what this device keeps for a file id, in whatever form it was kept. */
export async function openStored(id: string): Promise<StoredFile | undefined> {
  const row = await activeDatabase().files.get(id)
  if (!row) return
  const meta = readMeta(id, row)
  if (!meta) return
  if (meta.opfs && meta.key && meta.header && meta.lengths) {
    const cipher = await openNamed(activeUserId(), 'files', opfsName(id))
    if (!cipher) {
      await activeDatabase().files.delete(id)
      return
    }
    return { kind: 'opfs', meta: { key: meta.key, header: meta.header, lengths: meta.lengths }, cipher, size: row.size }
  }
  if (meta.data) return { kind: 'bytes', bytes: unb64(meta.data), size: row.size }
  return
}

/** Plaintext blob for viewing, saving, or sharing. */
export async function readBlob(id: string, mime = 'application/octet-stream'): Promise<Blob | undefined> {
  const stored = await openStored(id)
  if (!stored) return
  if (stored.kind === 'bytes') return new Blob([stored.bytes as BlobPart], { type: mime })
  const parts = await decryptParts(stored.cipher, stored.meta)
  return new Blob(parts as BlobPart[], { type: mime })
}

export async function readBytes(id: string) {
  const blob = await readBlob(id)
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
}

export async function hasStored(id: string) {
  return Boolean(await activeDatabase().files.get(id))
}

/** Ids of every file this device keeps for the active account. */
export async function storedIds() {
  return new Set((await activeDatabase().files.toCollection().primaryKeys()).map(String))
}

export async function forgetFile(id: string) {
  await activeDatabase().files.delete(id)
  const userId = activeUserId()
  if (userId && opfsAvailable()) await removeNamed(userId, 'files', opfsName(id))
}

/** Remove OPFS blobs that no longer have a row, plus scratch directories from older builds. */
export async function reconcileFiles() {
  const userId = activeUserId()
  if (!userId || !opfsAvailable()) return
  const rows = new Set((await activeDatabase().files.toCollection().primaryKeys()).map((key) => opfsName(String(key))))
  for (const name of await listNamed(userId, 'files')) {
    if (!rows.has(name)) await removeNamed(userId, 'files', name)
  }
  await removeKind(userId, 'attachments')
  await removeKind(userId, 'pending')
  await removeKind(userId, 'sync-temp')
}

export async function storageUsage() {
  const [files, records, outbox] = await Promise.all([activeDatabase().files.toArray(), activeDatabase().records.toArray(), activeDatabase().outbox.toArray()])
  const fileBytes = files.reduce((sum, row) => sum + row.size, 0)
  const chatBytes = records.reduce((sum, row) => sum + row.ciphertext.length, 0)
  const queueBytes = outbox.reduce((sum, row) => sum + row.ciphertext.length, 0)
  return {
    fileBytes,
    chatBytes,
    queueBytes,
    total: fileBytes + chatBytes + queueBytes,
    files: files.length,
    messages: records.filter((row) => row.id !== 'identity').length,
  }
}

export async function enforceStorageLimit() {
  const limit = storageLimitBytes()
  const removed: string[] = []
  if (!Number.isFinite(limit)) return removed
  let used = (await storageUsage()).total
  const files = await activeDatabase().files.orderBy('savedAt').toArray()
  for (const file of files) {
    if (used <= limit) break
    await forgetFile(file.id)
    used -= file.size
  }
  if (used <= limit) return removed
  const opened: { id: string; at: string; bytes: number; fileIds: string[] }[] = []
  for (const row of await activeDatabase().records.toArray()) {
    if (row.id === 'identity') continue
    try {
      const message = decryptRecord<{ at?: string; files?: { id: string }[] }>(getDek(), row.id, 'messages', row.nonce, row.ciphertext)
      opened.push({ id: row.id, at: message.at || '', bytes: row.ciphertext.length, fileIds: message.files?.map((file) => file.id) ?? [] })
    } catch {
      continue
    }
  }
  opened.sort((a, b) => a.at.localeCompare(b.at))
  const drop = opened.slice(0, Math.max(0, opened.length - 30))
  for (const message of drop) {
    if (used <= limit) break
    await activeDatabase().records.delete(message.id)
    used -= message.bytes
    removed.push(message.id)
    for (const fileId of message.fileIds) {
      const file = await activeDatabase().files.get(fileId)
      if (!file) continue
      await forgetFile(fileId)
      used -= file.size
    }
  }
  return removed
}

export async function cleanOldFiles(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const old = await activeDatabase().files.where('savedAt').below(cutoff).toArray()
  for (const row of old) await forgetFile(row.id)
  const messageIds = await enforceStorageLimit()
  return {
    fileCount: old.length,
    bytes: old.reduce((sum, row) => sum + row.size, 0),
    messageIds,
  }
}
