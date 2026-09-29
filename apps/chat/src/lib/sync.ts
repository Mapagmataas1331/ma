import { activeDatabase } from './db'
import { getDek, isUnlocked, sealRow } from './vault'

export type SyncMessage = {
  id: string
  conversationId: string
  body: string
  mine: boolean
  at: string
  status: string
  senderId?: string
  files?: { id: string; name?: string; mime?: string; size?: number; url?: string; via?: string; key?: string; header?: string; lengths?: number[]; gone?: boolean }[]
  deliveredAt?: string
  readAt?: string
  route?: 'direct' | 'server' | 'mixed'
}

const rank: Record<string, number> = {
  cancelled: 0,
  failed: 1,
  expired: 1,
  queued: 2,
  connecting: 2,
  sending: 2,
  sending_p2p: 3,
  mailboxing: 3,
  stored: 3,
  sent: 4,
  delivered: 5,
  read: 6,
}

export function messageRank(status: string) {
  return rank[status] ?? 0
}

function withoutUrls(message: SyncMessage): SyncMessage {
  return { ...message, files: message.files?.map(({ url: _url, ...file }) => file) }
}

function mergeFiles(left: SyncMessage['files'], right: SyncMessage['files']) {
  const map = new Map<string, NonNullable<SyncMessage['files']>[number]>()
  for (const file of [...(left ?? []), ...(right ?? [])]) {
    const current = map.get(file.id)
    map.set(file.id, current ? { ...current, ...file, url: file.url || current.url } : file)
  }
  return [...map.values()]
}

export function mergeMessage(local: SyncMessage | undefined, remote: SyncMessage): SyncMessage {
  if (!local) return withoutUrls(remote)
  const files = mergeFiles(local.files, remote.files)
  if (messageRank(remote.status) > messageRank(local.status)) return withoutUrls({ ...local, ...remote, files })
  return withoutUrls({ ...local, files })
}

export function mergeHistories(local: SyncMessage[], remote: SyncMessage[]) {
  const map = new Map(local.map((message) => [message.id, withoutUrls(message)]))
  for (const message of remote) {
    if (!message?.id) continue
    map.set(message.id, mergeMessage(map.get(message.id), message))
  }
  return [...map.values()].sort((a, b) => a.at.localeCompare(b.at))
}

export async function exportHistory(): Promise<SyncMessage[]> {
  if (!isUnlocked()) return []
  const rows = await activeDatabase().records.toArray()
  const out: SyncMessage[] = []
  const dek = getDek()
  const { decryptRecord } = await import('@ma/crypto')
  for (const row of rows) {
    if (row.id === 'identity' || row.id.startsWith('device:')) continue
    try {
      const message = decryptRecord<SyncMessage>(dek, row.id, 'messages', row.nonce, row.ciphertext)
      if (message?.id && message.conversationId) out.push(withoutUrls({ ...message, id: row.id }))
    } catch {
      continue
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

export async function storeHistory(remote: SyncMessage[]) {
  const local = await exportHistory()
  const merged = mergeHistories(local, remote)
  const previous = new Map(local.map((message) => [message.id, JSON.stringify(message)]))
  for (const message of merged) {
    if (previous.get(message.id) === JSON.stringify(message)) continue
    await sealRow('records', message.id, 'messages', withoutUrls(message))
  }
  return merged
}

export function chunkMessages(messages: SyncMessage[], size = 25) {
  const batches: SyncMessage[][] = []
  for (let offset = 0; offset < messages.length; offset += size) batches.push(messages.slice(offset, offset + size))
  return batches
}
