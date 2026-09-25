import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Progress } from './primitives'

export function PresenceDot({ online }: { online: boolean }) {
  return <span className={cn('inline-block size-2 rounded-full', online ? 'bg-ok' : 'bg-muted/50')} aria-label={online ? 'Online' : 'Offline'} />
}

export function MessageBubble({
  mine,
  grouped,
  time,
  status,
  children,
}: {
  mine?: boolean
  grouped?: boolean
  time?: string
  status?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-3')}>
      <div className={cn('max-w-[min(100%,34rem)] px-3.5 py-2 text-sm leading-relaxed shadow-float', mine ? 'rounded-lg rounded-br-sm bg-accent text-accent-fg' : 'rounded-lg rounded-bl-sm bg-surface-1 text-fg')}>
        {children}
        {time || status ? (
          <p className={cn('mt-1 text-[11px]', mine ? 'text-accent-fg/70' : 'text-muted')}>
            {time}
            {status ? ` · ${status}` : ''}
          </p>
        ) : null}
      </div>
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
  return <p className="px-1 py-1 text-xs text-muted">{name} is typing…</p>
}

export function TransferProgress({ name, value, onCancel }: { name: string; value: number; onCancel?: () => void }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{name}</span>
        {onCancel ? (
          <button type="button" className="text-xs text-muted hover:text-fg" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <Progress value={value} label={name} />
    </div>
  )
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
