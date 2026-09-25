import Dexie, { type Table } from 'dexie'

export type VaultRow = {
  id: 'main'
  version: number
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
  state: 'queued' | 'sending_p2p' | 'mailboxing' | 'mailboxed' | 'waiting_peer' | 'delivered' | 'failed' | 'sent'
  envelope: string
  size: number
  attempts: number
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

  constructor() {
    super('ma-chat')
    this.version(1).stores({
      vault: 'id',
      records: 'id, conversationLocalId, sortKey, kind',
      outbox: 'id, conversationId, state',
    })
    this.version(2).stores({
      vault: 'id',
      records: 'id',
      outbox: 'id',
    }).upgrade(async (tx) => {
      await tx.table('outbox').clear()
      const records = await tx.table('records').toArray()
      for (const row of records) {
        await tx.table('records').put({ id: row.id, nonce: row.nonce, ciphertext: row.ciphertext })
      }
    })
    this.version(3).stores({
      vault: 'id',
      records: 'id',
      outbox: 'id',
      files: 'id, savedAt',
    })
  }
}

export const db = new ChatDB()
