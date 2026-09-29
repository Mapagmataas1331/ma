import { MAILBOX_USER_QUOTA_BYTES } from '@ma/protocol'
import { Button, Dialog } from '@ma/ui'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '../messages/format'

export type CloudFileInfo = {
  file_id: string
  conversation_id: string
  name: string
  size: number
  recipients: number
  waiting: number
}

export type CloudUsage = {
  used: number
  limit: number
  files: CloudFileInfo[]
}

export function cloudUsage(value: unknown): CloudUsage | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<CloudUsage>
  if (typeof row.used !== 'number' || typeof row.limit !== 'number' || !Array.isArray(row.files)) return null
  return { used: row.used, limit: row.limit, files: row.files.filter((file) => file && typeof file.file_id === 'string') }
}

export function CloudQuotaDialog({
  open,
  usage,
  need,
  titleFor,
  onOpenChange,
  onRemove,
  onSendDirect,
}: {
  open: boolean
  usage: CloudUsage | null
  /** Bytes the send still needs. Zero when the dialog is opened from settings. */
  need: number
  titleFor: (conversationId: string) => string
  onOpenChange: (open: boolean) => void
  onRemove: (fileId: string) => void
  onSendDirect?: () => void
}) {
  const { t } = useTranslation('common')
  const used = usage?.used ?? 0
  const limit = usage?.limit ?? 0
  const room = Math.max(0, limit - used)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('cloudStorage')}
      description={need > 0 ? t('cloudQuotaHit', { used: formatBytes(used), limit: formatBytes(limit), need: formatBytes(need), room: formatBytes(room) }) : t('cloudStorageLead', { limit: formatBytes(limit || MAILBOX_USER_QUOTA_BYTES) })}
    >
      <p className="mb-3 text-sm text-muted">{t('cloudExpires')}</p>
      <p className="mb-3 text-sm">{t('cloudUsed', { used: formatBytes(used), limit: formatBytes(limit || MAILBOX_USER_QUOTA_BYTES) })}</p>
      {usage?.files.length ? (
        <ul className="flex flex-col gap-2">
          {usage.files.map((file) => (
            <li key={file.file_id} className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{file.name || t('attachment')}</span>
                <span className="block truncate text-xs text-muted">
                  {formatBytes(file.size)}
                  {titleFor(file.conversation_id) ? ` · ${titleFor(file.conversation_id)}` : ''}
                  {` · ${t('cloudWaiting', { count: file.waiting })}`}
                </span>
              </span>
              <Button variant="outline" className="shrink-0" onClick={() => onRemove(file.file_id)}>{t('cloudRemove')}</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('cloudEmpty')}</p>
      )}
      {need > 0 && onSendDirect ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-muted">{t('cloudSendDirectHint')}</p>
          <Button onClick={onSendDirect}>{t('cloudSendDirect')}</Button>
        </div>
      ) : null}
    </Dialog>
  )
}
