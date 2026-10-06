import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

// Static, Radix-free building blocks for content pages. Kept out of primitives.tsx so a page that
// only needs these (projects list / detail) does not pull every Radix widget and sonner into its
// entry chunk. primitives.tsx and the package index re-export them unchanged.

export function Surface({ className, children, strong }: { className?: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('ma-surface rounded-lg border border-line bg-surface-1 shadow-float', strong && 'ma-surface--strong', className)}>
      {children}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <Surface className={cn('p-5', className)}>{children}</Surface>
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-line/80 bg-surface-2/90 px-2.5 py-0.5 text-[11px] font-medium text-fg/85', className)}>
      {children}
    </span>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="ma-surface ma-surface--strong flex flex-col items-center justify-center gap-2 rounded-lg border border-line px-6 py-14 text-center shadow-float">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  )
}

export function PageHeader({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <header className="mb-8">
      {eyebrow ? <p className="mb-2 text-xs tracking-[0.18em] text-muted uppercase">{eyebrow}</p> : null}
      <h1 className="text-[clamp(1.75rem,7vw,3rem)] leading-[1.15] font-semibold tracking-tight break-words">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{lead}</p> : null}
    </header>
  )
}
