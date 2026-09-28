import { plaintextMessageSchema, type PlaintextMessage } from '@ma/protocol'

export function parsePlaintext(value: string): PlaintextMessage | null {
  try {
    const parsed = plaintextMessageSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
