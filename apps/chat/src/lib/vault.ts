import {
  b64,
  boxKeyPair,
  decryptRecord,
  deriveKek,
  encryptRecord,
  interactiveKdf,
  randomDek,
  ready,
  signKeyPair,
  unb64,
  unwrapDek,
  wrapDek,
  zero,
  type WrappedSlot,
} from '@ma/crypto'
import { db } from './db'

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
}

function armLock(minutes = 15) {
  if (lockTimer) window.clearTimeout(lockTimer)
  lockTimer = window.setTimeout(lockVault, minutes * 60_000)
}

async function readSlots() {
  const row = await db.vault.get('main')
  return (row?.slots ?? []) as WrappedSlot[]
}

export async function hasVault() {
  return Boolean(await db.vault.get('main'))
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
  await db.vault.put({ id: 'main', version: 1, slots: [slot], createdAt: new Date().toISOString() })
  await db.records.put({ id: 'identity', nonce: rec.nonce, ciphertext: rec.ciphertext })
  secrets = {
    dek,
    identitySign: { publicKey: keys.signPk, privateKey: sign.privateKey },
    identityBox: { publicKey: keys.boxPk, privateKey: box.privateKey },
  }
  armLock()
  return { ed25519: keys.signPk, x25519: keys.boxPk }
}

export async function unlockVault(password: string) {
  await ready()
  const slots = await readSlots()
  const slot = slots.find((s) => s.kind === 'password')
  if (!slot) throw new Error('no vault')
  const dek = unwrapDek(deriveKek(password, slot.kdf), slot)
  const row = await db.records.get('identity')
  if (!row) throw new Error('missing identity')
  const keys = decryptRecord<{ signPk: string; signSk: string; boxPk: string; boxSk: string }>(dek, 'identity', 'keys', row.nonce, row.ciphertext)
  secrets = {
    dek,
    identitySign: { publicKey: keys.signPk, privateKey: unb64(keys.signSk) },
    identityBox: { publicKey: keys.boxPk, privateKey: unb64(keys.boxSk) },
  }
  armLock()
}

export async function changeVaultPassword(current: string, next: string) {
  await ready()
  const slots = await readSlots()
  const slot = slots.find((s) => s.kind === 'password')
  if (!slot) throw new Error('no vault')
  const dek = unwrapDek(deriveKek(current, slot.kdf), slot)
  const kdf = interactiveKdf()
  const wrapped = wrapDek(deriveKek(next, kdf), dek, 'password', kdf)
  const others = slots.filter((s) => s.kind !== 'password')
  await db.vault.update('main', { slots: [wrapped, ...others] })
  zero(dek)
}

export async function addRecoverySlot() {
  await ready()
  if (!secrets) throw new Error('locked')
  const recovery = b64(randomDek())
  const kdf = interactiveKdf()
  const slot = wrapDek(deriveKek(recovery, kdf), secrets.dek, 'recovery', kdf)
  const slots = await readSlots()
  await db.vault.update('main', { slots: [...slots.filter((s) => s.kind !== 'recovery'), slot] })
  return recovery
}

export async function sealRow(table: 'records' | 'outbox', id: string, kind: string, value: unknown) {
  const rec = encryptRecord(getDek(), id, kind, value)
  await db[table].put({ id, nonce: rec.nonce, ciphertext: rec.ciphertext })
}

export async function openRow<T>(table: 'records' | 'outbox', id: string, kind: string): Promise<T | undefined> {
  const row = await db[table].get(id)
  if (!row) return undefined
  return decryptRecord<T>(getDek(), id, kind, row.nonce, row.ciphertext)
}

export async function loadHistory(): Promise<{ id: string; conversationId: string; body: string; mine: boolean; at: string; status: string }[]> {
  const rows = await db.records.toArray()
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

export function touchVault() {
  if (secrets) armLock()
}
