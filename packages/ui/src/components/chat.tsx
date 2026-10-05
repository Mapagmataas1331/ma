import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { HoldMenu, Progress } from './primitives'

export function PresenceDot({ online }: { online: boolean }) {
  const { t } = useTranslation('common')
  return <span className={cn('inline-block size-2 rounded-full', online ? 'bg-ok' : 'bg-muted/50')} aria-label={online ? t('online') : t('offline')} />
}

export function MessageBubble({
  mine,
  grouped,
  time,
  status,
  sender,
  menu,
  children,
}: {
  mine?: boolean
  grouped?: boolean
  time?: string
  status?: string
  /** Shown above the bubble in group chats when the previous message came from someone else. */
  sender?: string
  menu?: { label: string; items: { id: string; label: string; onSelect: () => void }[] }
  children: ReactNode
}) {
  const bubble = (
    <div className={cn('px-3.5 py-2 text-sm leading-relaxed break-words shadow-float', mine ? 'rounded-lg rounded-br-sm bg-accent text-accent-fg' : 'rounded-lg rounded-bl-sm bg-surface-1 text-fg')}>
      {sender && !grouped ? <p className="mb-0.5 text-xs font-medium text-accent">{sender}</p> : null}
      {children}
      {time || status ? (
        <p className={cn('mt-1 text-[11px]', mine ? 'text-accent-fg/70' : 'text-muted')}>
          {time}
          {status ? ` · ${status}` : ''}
        </p>
      ) : null}
    </div>
  )
  return (
    <div className={cn('pointer-events-none flex w-full', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-3')}>
      {menu?.items.length ? (
        <HoldMenu className="pointer-events-auto !min-w-[auto] max-w-[min(85%,34rem)]" label={menu.label} items={menu.items}>{bubble}</HoldMenu>
      ) : (
        <div className="pointer-events-auto max-w-[min(85%,34rem)]">{bubble}</div>
      )}
    </div>
  )
}

export function MessageGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function TypingIndicator({ name }: { name: string }) {
  const { t } = useTranslation('common')
  return <p className="px-1 py-1 text-xs text-muted">{t('typing', { name })}</p>
}

export function TransferProgress({ title, loaded, total, startedAt, onCancel }: { title: string; loaded: number; total: number; startedAt: number; onCancel?: () => void }) {
  const { t } = useTranslation('common')
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  const elapsed = Math.max(1, (Date.now() - startedAt) / 1000)
  const rate = loaded / elapsed
  const left = rate > 0 && total > loaded ? (total - loaded) / rate : 0
  const eta = left > 0 && loaded > 0 ? (left < 60 ? t('etaSec', { count: Math.max(1, Math.round(left)) }) : t('etaMin', { count: Math.max(1, Math.round(left / 60)) })) : ''
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="truncate text-sm">{title}</p>
        {onCancel ? <button type="button" className="shrink-0 text-xs text-muted" onClick={onCancel}>{t('cancel')}</button> : null}
      </div>
      <p className="mb-2 text-xs text-muted">{formatSize(loaded)} / {formatSize(total)} · {formatSize(rate)}/s{eta ? ` · ${t('timeLeft', { time: eta })}` : ''}</p>
      <Progress value={pct} label={title} />
    </div>
  )
}

export type ChatFile = {
  id: string
  name: string
  mime: string
  size: number
  url?: string
  via?: 'mailbox' | 'peer'
  key?: string
  header?: string
  lengths?: number[]
  /** The source confirmed it no longer has this file. */
  gone?: boolean
}

/**
 * Where a file can be fetched from right now.
 * - `ready`: bytes are on this device.
 * - `server`: waiting in the encrypted mailbox.
 * - `peer`: someone in the chat is online and can hand the file over. The closest connection is chosen.
 * - `offline`: the other device is offline, so nothing can be fetched yet.
 * - `gone`: nobody reachable has it any more.
 * - `sharing`: our own large file that this device can still hand out.
 * - `sessionOnly`: our own file kept only in memory; reloading the page drops it.
 */
export type FileAvailability = 'ready' | 'server' | 'peer' | 'offline' | 'gone' | 'sharing' | 'sessionOnly'

export function availabilityLabel(t: (key: string) => string, state: FileAvailability, file?: Pick<ChatFile, 'via'>) {
  if (state === 'gone') {
    return t(file?.via === 'peer' ? 'fileNotAvailableForTransfer' : 'fileNotOnServer')
  }
  const map: Record<Exclude<FileAvailability, 'gone'>, string> = {
    ready: 'fileReady',
    server: 'fileOnServer',
    peer: 'fileAvailable',
    offline: 'fileSenderOffline',
    sharing: 'fileSharing',
    sessionOnly: 'fileSessionOnly',
  }
  return t(map[state])
}

function availabilityTone(state: FileAvailability) {
  if (state === 'gone') return 'text-danger'
  if (state === 'offline' || state === 'sessionOnly') return 'opacity-70'
  return 'opacity-80'
}

export function MessageAttachments({
  files,
  expanded,
  downloading,
  availability,
  onExpand,
  onDownload,
  onView,
  fileMenu,
}: {
  files: ChatFile[]
  expanded?: boolean
  downloading?: string | null
  availability?: (file: ChatFile) => FileAvailability | undefined
  onExpand?: () => void
  onDownload?: (file: ChatFile) => void
  onView?: (file: ChatFile) => void
  fileMenu?: (file: ChatFile) => { id: string; label: string; onSelect: () => void }[]
}) {
  const { t } = useTranslation('common')
  const shown = expanded ? files : files.slice(0, 5)
  const images = shown.filter((file) => file.mime.startsWith('image/'))
  const videos = shown.filter((file) => file.url && file.mime.startsWith('video/'))
  const rest = shown.filter((file) => !file.mime.startsWith('image/') && !(file.url && file.mime.startsWith('video/')))
  function wrap(file: ChatFile, node: ReactNode) {
    const items = fileMenu?.(file) ?? []
    if (!items.length) return <div key={file.id}>{node}</div>
    return <HoldMenu key={file.id} label={file.name} items={items}>{node}</HoldMenu>
  }
  return (
    <div className="space-y-2">
      {images.length ? (
        <div className={images.length > 1 ? 'grid grid-cols-2 gap-1' : ''}>
          {images.map((file) => {
            const state = availability?.(file)
            return wrap(file, file.url ? (
              <button type="button" className="block w-full" onClick={() => onView?.(file)}>
                <img src={file.url} alt={file.name} className="max-h-72 w-full rounded-md object-cover" />
              </button>
            ) : (
              <button type="button" className="flex min-h-24 w-full flex-col items-start justify-center rounded-md bg-black/10 px-3 py-2 text-left" onClick={() => onView?.(file)} disabled={state === 'gone'}>
                <span className="w-full truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs opacity-80">{formatSize(file.size)}</span>
                <span className={cn('text-xs', state ? availabilityTone(state) : 'opacity-80')}>{state ? availabilityLabel(t, state, file) : t('view')}</span>
              </button>
            ))
          })}
        </div>
      ) : null}
      {videos.map((file) => wrap(file, (
        <video src={file.url} controls playsInline className="max-h-72 w-full rounded-md bg-black" />
      )))}
      {rest.map((file) => wrap(file, (
        <FileOffer file={file} state={availability?.(file)} downloading={downloading === file.id} onDownload={onDownload ? () => onDownload(file) : undefined} onView={onView ? () => onView(file) : undefined} />
      )))}
      {!expanded && files.length > 5 && onExpand ? (
        <button type="button" className="text-xs underline underline-offset-2" onClick={onExpand}>
          {t('moreFiles', { count: files.length - 5 })}
        </button>
      ) : null}
    </div>
  )
}

function FileOffer({ file, state, downloading, onDownload, onView }: { file: ChatFile; state?: FileAvailability; downloading?: boolean; onDownload?: () => void; onView?: () => void }) {
  const { t } = useTranslation('common')
  const format = fileFormat(file.name, file.mime)
  const blocked = state === 'gone' || state === 'offline'
  return (
    <div className="min-w-48 rounded-md bg-black/10 px-3 py-2">
      <button type="button" className="block w-full text-left" onClick={onView}>
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs opacity-80">{format} · {formatSize(file.size)}</p>
        {state ? <p className={cn('text-xs', availabilityTone(state))}>{availabilityLabel(t, state, file)}</p> : null}
      </button>
      {file.url && file.mime.startsWith('audio/') ? <audio src={file.url} controls className="mt-2 w-full" /> : null}
      {onDownload && !blocked ? (
        <button type="button" className="mt-1 text-xs underline underline-offset-2" onClick={onDownload} disabled={downloading}>
          {downloading ? t('downloading') : file.url ? t('save') : t('download')}
        </button>
      ) : null}
    </div>
  )
}

function fileFormat(name: string, mime: string) {
  const ext = name.includes('.') ? name.split('.').pop() : ''
  if (ext) return ext.toUpperCase()
  return (mime.split('/')[1] || 'file').toUpperCase()
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function AttachmentPreview({ name, kind, src }: { name: string; kind: string; src?: string }) {
  if (src && kind.startsWith('image/')) {
    return <img src={src} alt={name} className="max-h-48 rounded-md object-cover" />
  }
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs">
      <p className="font-medium">{name}</p>
      <p className="text-muted">{kind || 'file'}</p>
    </div>
  )
}

export function ConversationListItem({
  name,
  preview,
  time,
  unread,
  online,
  active,
  onClick,
}: {
  name: string
  preview?: string
  time?: string
  unread?: number
  online?: boolean
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2', active && 'bg-surface-2')}>
      <span className="relative">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{name.slice(0, 1).toUpperCase()}</span>
        <span className="absolute right-0 bottom-0"><PresenceDot online={!!online} /></span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {time ? <span className="text-[11px] text-muted">{time}</span> : null}
        </span>
        {preview ? <span className="block truncate text-xs text-muted">{preview}</span> : null}
      </span>
      {unread ? <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-fg">{unread}</span> : null}
    </button>
  )
}
