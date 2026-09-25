import { z } from 'zod'

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
})

export type ApiErrorBody = z.infer<typeof apiErrorSchema>

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  email: z.string().nullable().optional(),
  totp_enabled: z.boolean().optional(),
})

export const deviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  platform: z.string(),
  trust_state: z.enum(['pending', 'trusted', 'revoked']),
  last_seen_at: z.string().nullable().optional(),
  current: z.boolean().optional(),
})

export const signalFrameSchema = z.object({
  v: z.literal(1),
  t: z.string(),
  id: z.string(),
  to: z.object({ user: z.string(), device: z.string().optional() }).optional(),
  from: z.object({ user: z.string(), device: z.string() }).optional(),
  p: z.record(z.unknown()).default({}),
})

export type SignalFrame = z.infer<typeof signalFrameSchema>

export const envelopeSchema = z.object({
  v: z.literal(1),
  alg: z.literal('x25519-xchacha20poly1305'),
  sender_identity_pk: z.string(),
  nonce: z.string(),
  ciphertext: z.string(),
})

export type Envelope = z.infer<typeof envelopeSchema>

export const plaintextMessageSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string(),
  sent_at: z.string(),
  kind: z.enum(['text', 'file_offer', 'receipt', 'edit', 'delete']),
  body: z.string().default(''),
  attachments: z
    .array(
      z.object({
        file_id: z.string(),
        name: z.string(),
        mime: z.string(),
        size: z.number(),
        key: z.string().optional(),
        header: z.string().optional(),
      }),
    )
    .default([]),
})

export type PlaintextMessage = z.infer<typeof plaintextMessageSchema>

export const MAILBOX_MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024
export const MAILBOX_DIRECT_FILE_BYTES = 26_214_400
export const MAILBOX_MAX_MESSAGE_BYTES = 65_536

export function newFrame(t: string, p: Record<string, unknown> = {}, to?: SignalFrame['to']): SignalFrame {
  return { v: 1, t, id: crypto.randomUUID(), to, p }
}
