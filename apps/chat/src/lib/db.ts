import Dexie, { type Table } from 'dexie'

export type VaultRow = {
  id: 'main'
  version: number
  ownerUserId: string
  slots: unknown[]
  createdAt: string
}

/** Only the id is visible. Everything else is inside the ciphertext. */
export type SealedRow = {
  id: string
  nonce: string
  ciphertext: string
}

export type OutboxPlain = {
  id: string
  conversationId: string
  recipientUserId: string
  state: 'queued' | 'connecting' | 'sending_p2p' | 'mailboxing' | 'stored' | 'waiting_peer' | 'delivered' | 'read' | 'failed' | 'cancelled' | 'expired' | 'sent'
  envelope: string
  size: number
  attempts: number
  recipientPk?: string
  deviceId?: string
  nextAttemptAt?: string
}

export type FileBlobRow = {
  id: string
  size: number
  savedAt: number
  nonce: string
  ciphertext: string
}

export class ChatDB extends Dexie {
  vault!: Table<VaultRow, string>
  records!: Table<SealedRow, string>
  outbox!: Table<SealedRow, string>
  files!: Table<FileBlobRow, string>

  transfers!: Table<SealedRow, string>
  pins!: Table<SealedRow, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      vault: 'id',
      records: 'id',
      outbox: 'id',
      files: 'id, savedAt',
    })
    this.version(2).stores({
      vault: 'id',
      records: 'id',
      outbox: 'id',
      files: 'id, savedAt',
      transfers: 'id',
      pins: 'id',
    })
  }
}

let current: ChatDB | null = null
let currentUser = ''

export function activeUserId() {
  return currentUser
}

export function activeDatabase() {
  if (!current) throw new Error('no database')
  return current
}

export function accountDatabaseName(userId: string) {
  return `ma-chat-v2:${userId}`
}

const REGISTRY = 'ma.chat.accounts'

export function knownAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REGISTRY) || '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function rememberAccount(userId: string) {
  const next = knownAccounts()
  if (!next.includes(userId)) localStorage.setItem(REGISTRY, JSON.stringify([...next, userId]))
}

export async function openAccount(userId: string) {
  if (!userId) throw new Error('user')
  if (current && currentUser === userId) return current
  await closeAccount()
  const db = new ChatDB(accountDatabaseName(userId))
  await db.open()
  current = db
  currentUser = userId
  rememberAccount(userId)
  return db
}

export async function closeAccount() {
  current?.close()
  current = null
  currentUser = ''
}

export async function databaseNames() {
  if (!indexedDB.databases) return []
  const rows = await indexedDB.databases()
  return rows.map((row) => row.name || '').filter(Boolean)
}

export async function hasLegacyVault() {
  return (await databaseNames()).includes('ma-chat')
}

export function legacyDatabase() {
  return new ChatDB('ma-chat')
}

export function accountKey(userId: string, name: string) {
  return `ma.chat.${userId}.${name}`
}

export async function deleteUserLocalData(userId: string) {
  if (!userId) return
  if (currentUser === userId) await closeAccount()
  await Dexie.delete(accountDatabaseName(userId))
  const next = knownAccounts().filter((id) => id !== userId)
  localStorage.setItem(REGISTRY, JSON.stringify(next))
}
