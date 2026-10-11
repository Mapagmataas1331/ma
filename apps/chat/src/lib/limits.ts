import { api } from '@ma/api-client'
import { MAILBOX_MAX_FILE_BYTES, MAILBOX_USER_QUOTA_BYTES } from '@ma/protocol'

export type MailboxLimits = { maxFileBytes: number; userQuotaBytes: number }

/** Built-in values, used until the server answers. The server's `/v1/capabilities` is the source of truth. */
const FALLBACK: MailboxLimits = { maxFileBytes: MAILBOX_MAX_FILE_BYTES, userQuotaBytes: MAILBOX_USER_QUOTA_BYTES }

let current: MailboxLimits = FALLBACK
let loading: Promise<MailboxLimits> | null = null

function positive(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/** Cloud (mailbox) limits as last reported by the server, or the built-in fallback. */
export function mailboxLimits() {
  return current
}

/** Ask the server once per page load; later calls share the answer. Failures keep the fallback and retry next time. */
export function loadMailboxLimits() {
  if (!loading) {
    loading = api<{ max_file_bytes?: number; user_quota_bytes?: number }>('/v1/capabilities')
      .then((row) => {
        current = { maxFileBytes: positive(row.max_file_bytes, FALLBACK.maxFileBytes), userQuotaBytes: positive(row.user_quota_bytes, FALLBACK.userQuotaBytes) }
        return current
      })
      .catch(() => {
        loading = null
        return current
      })
  }
  return loading
}
