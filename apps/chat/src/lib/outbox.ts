import { api } from '@ma/api-client'
import type { OutboxPlain } from './db'
import { activeDatabase } from './db'
import { transport } from './transport'
import { isUnlocked, openRow, sealRow } from './vault'

const done = new Set(['delivered', 'read', 'cancelled', 'expired', 'sent', 'stored'])

export async function saveOutbox(row: OutboxPlain) {
  await sealRow('outbox', row.id, 'outbox', row)
}

export async function replayOutbox(): Promise<{ id: string; route: 'direct' | 'server' }[]> {
  if (!isUnlocked()) return []
  const sent: { id: string; route: 'direct' | 'server' }[] = []
  const rows = await activeDatabase().outbox.toArray()
  for (const row of rows) {
    const plain = await openRow<OutboxPlain>('outbox', row.id, 'outbox').catch(() => undefined)
    if (!plain?.recipientPk || done.has(plain.state)) continue
    plain.attempts += 1
    plain.state = 'connecting'
    await sealRow('outbox', plain.id, 'outbox', plain)
    try {
      let deviceId = plain.deviceId || ''
      if (!deviceId) {
        const devices = await api<{ id: string }[]>(`/v1/contacts/${plain.recipientUserId}/devices`).catch(() => [])
        deviceId = devices[0]?.id || ''
        plain.deviceId = deviceId
      }
      const route = await transport.deliverText(plain, plain.recipientPk, deviceId, deviceId ? [deviceId] : [], !!deviceId)
      sent.push({ id: plain.id, route })
    } catch (err) {
      if (err instanceof Error && err.message === 'direct_only') {
        plain.state = 'waiting_peer'
        await sealRow('outbox', plain.id, 'outbox', plain)
        continue
      }
      plain.state = 'failed'
      plain.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(plain.attempts, 5))).toISOString()
      await sealRow('outbox', plain.id, 'outbox', plain)
    }
  }
  return sent
}
