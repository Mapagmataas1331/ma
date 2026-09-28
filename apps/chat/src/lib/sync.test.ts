import { describe, expect, it } from 'vitest'
import { mergeHistories, type SyncMessage } from './sync'

function message(id: string, status: string, body = id): SyncMessage {
  return { id, conversationId: 'c', body, mine: true, at: '2026-01-01T00:00:00.000Z', status }
}

describe('device history sync', () => {
  it('keeps messages that exist on only one device', () => {
    const merged = mergeHistories([message('local', 'sent', 'from this device')], [message('remote', 'sent', 'from the other device')])
    expect(merged.map((item) => item.id).sort()).toEqual(['local', 'remote'])
  })

  it('keeps the further delivery status when both devices have the same message', () => {
    const merged = mergeHistories([message('same', 'sent')], [message('same', 'read', 'from the other device')])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.status).toBe('read')
    expect(merged[0]?.body).toBe('from the other device')
  })

  it('does not downgrade a message that is already read locally', () => {
    const merged = mergeHistories([message('same', 'read', 'kept')], [message('same', 'sent', 'older')])
    expect(merged[0]?.status).toBe('read')
    expect(merged[0]?.body).toBe('kept')
  })
})
