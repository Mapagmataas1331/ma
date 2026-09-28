import type { OutboxPlain } from './db'
import { activeDatabase } from './db'
import { transport } from './transport'
import { isUnlocked, openRow, sealRow } from './vault'

const done = new Set(['delivered', 'read', 'cancelled', 'expired', 'sent', 'stored'])

export async function saveOutbox(row: OutboxPlain) {
  await sealRow('outbox', row.id, 'outbox', row)
}

export async function replayOutbox() {
  if (!isUnlocked()) return
  const rows = await activeDatabase().outbox.toArray()
  for (const row of rows) {
    const plain = await openRow<OutboxPlain>('outbox', row.id, 'outbox').catch(() => undefined)
    if (!plain?.recipientPk || done.has(plain.state)) continue
    plain.attempts += 1
    plain.state = 'connecting'
    await sealRow('outbox', plain.id, 'outbox', plain)
    try {
      await transport.deliverText(plain, plain.recipientPk, plain.deviceId || '')
    } catch {
      plain.state = 'failed'
      plain.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(plain.attempts, 5))).toISOString()
      await sealRow('outbox', plain.id, 'outbox', plain)
    }
  }
}
