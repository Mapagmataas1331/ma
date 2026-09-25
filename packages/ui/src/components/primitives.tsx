import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as LabelPrimitive from '@radix-ui/react-label'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { Slot } from '@radix-ui/react-slot'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Command } from 'cmdk'
import { Check, ChevronDown, X } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster as Sonner, toast } from 'sonner'
import { cn } from '../lib/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'icon'
  asChild?: boolean
}

const buttonClass = {
  base: 'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  primary: 'bg-accent text-accent-fg shadow-float hover:-translate-y-px',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  outline: 'border border-line bg-surface-1 text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:-translate-y-px',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'size-10',
}

export function Button({ className, variant = 'primary', size = 'md', asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonClass.base, buttonClass[variant], buttonClass[size], className)} {...props} />
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <Button variant="ghost" size="icon" aria-label={label} className={className} {...props} />
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full min-w-0 rounded-sm border border-line bg-surface-1 px-3 text-base text-fg outline-none transition placeholder:text-muted focus:ring-2 focus:ring-ring',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full min-w-0 resize-y rounded-md border border-line bg-surface-1 px-3 py-2 text-base text-fg outline-none focus:ring-2 focus:ring-ring',
        className,
      )}
      {...props}
    />
  )
}

export const Label = LabelPrimitive.Root

export function Surface({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-line bg-surface-1 shadow-float', className)}>{children}</div>
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <Surface className={cn('p-5', className)}>{children}</Surface>
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-surface-3 px-2.5 py-0.5 text-xs text-muted', className)}>
      {children}
    </span>
  )
}

export function Separator({ className, orientation = 'horizontal' }: { className?: string; orientation?: 'horizontal' | 'vertical' }) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'bg-line', className)}
    />
  )
}

export function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <AvatarPrimitive.Root className={cn('inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-sm font-semibold text-accent', className)}>
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback>{initials || '?'}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-6 w-11 rounded-full bg-surface-3 transition data-[state=checked]:bg-accent"
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface-1 shadow transition data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  )
}

export function Checkbox({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="flex size-5 items-center justify-center rounded-sm border border-line bg-surface-1 data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  )
}

export function Slider({ value, onValueChange, min = 0, max = 360, label }: { value: number; onValueChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={1}
      onValueChange={(v) => onValueChange(v[0] ?? min)}
      aria-label={label}
      className="relative flex h-5 w-full touch-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full border border-line bg-surface-1 shadow focus-visible:ring-2 focus-visible:ring-ring" />
    </SliderPrimitive.Root>
  )
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <ProgressPrimitive.Root value={value} aria-label={label} className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <ProgressPrimitive.Indicator className="h-full bg-accent transition-transform" style={{ transform: `translateX(-${100 - value}%)` }} />
    </ProgressPrimitive.Root>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3', className)} />
}

export function ScrollArea({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ScrollAreaPrimitive.Root className={cn('overflow-hidden', className)}>
      <ScrollAreaPrimitive.Viewport className="size-full">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex w-2 touch-none p-0.5">
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-line" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  )
}

export function Tabs({ value, onValueChange, tabs, children }: { value: string; onValueChange: (v: string) => void; tabs: { value: string; label: string }[]; children: ReactNode }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className="mb-4 inline-flex gap-1 rounded-md bg-surface-2 p-1">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger key={tab.value} value={tab.value} className="rounded-sm px-3 py-1.5 text-sm text-muted data-[state=active]:bg-surface-1 data-[state=active]:text-fg data-[state=active]:shadow-float">
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return <TabsPrimitive.Content value={value}>{children}</TabsPrimitive.Content>
}

export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const { t } = useTranslation('common')
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-fg/20 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(100%-1.5rem,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface-1 p-5 shadow-float sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close className="rounded-sm p-1 text-muted hover:bg-surface-2" aria-label={t('close')}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function HoldMenu({ label, items, children, className }: { label: string; items: { id: string; label: string; onSelect: () => void }[]; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const timer = useRef(0)
  const suppress = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  function openMenu() {
    suppress.current = true
    setOpen(true)
  }
  if (!items.length) return children
  return (
    <>
      <div
        className={cn('min-w-0 select-none', className)}
        style={{ WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openMenu()
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          start.current = { x: e.clientX, y: e.clientY }
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(openMenu, 450)
        }}
        onPointerUp={() => window.clearTimeout(timer.current)}
        onPointerLeave={() => window.clearTimeout(timer.current)}
        onPointerCancel={() => window.clearTimeout(timer.current)}
        onPointerMove={(e) => {
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 12) window.clearTimeout(timer.current)
        }}
        onClickCapture={(e) => {
          if (!suppress.current) return
          e.preventDefault()
          e.stopPropagation()
          suppress.current = false
        }}
      >
        {children}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={label}>
        <div className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-sm px-2 py-3 text-left text-sm hover:bg-surface-2"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  )
}

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-fg/20 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(100%,22rem)] flex-col overflow-hidden border-l border-line bg-surface-1 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-float">
          <DialogPrimitive.Title className="shrink-0 px-5 pt-5 text-lg font-semibold">{title}</DialogPrimitive.Title>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function Dropdown({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content className="z-50 min-w-44 rounded-md border border-line bg-surface-1 p-1 shadow-float backdrop-blur-md" sideOffset={6}>
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

export function DropdownItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <DropdownMenuPrimitive.Item onSelect={onSelect} className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2">
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="z-50 rounded-md border border-line bg-surface-1 p-3 shadow-float" sideOffset={6}>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="z-50 rounded-sm bg-fg px-2 py-1 text-xs text-bg shadow-float" sideOffset={6}>
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export function ContextMenu({ trigger, items }: { trigger: ReactNode; items: { label: string; onSelect: () => void }[] }) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-40 rounded-md border border-line bg-surface-1 p-1 shadow-float">
          {items.map((item) => (
            <ContextMenuPrimitive.Item key={item.label} onSelect={item.onSelect} className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2">
              {item.label}
            </ContextMenuPrimitive.Item>
          ))}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}

type CommandItem = { id: string; label: string; hint?: string; onSelect: () => void }
const CommandCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void; items: CommandItem[] } | null>(null)

export function CommandProvider({ items, children }: { items: CommandItem[]; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <CommandCtx.Provider value={{ open, setOpen, items }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen} title="Search">
        <Command className="flex flex-col gap-2" label="Command palette">
          <Command.Input placeholder="Type a command" className="h-10 rounded-sm border border-line bg-surface-2 px-3 text-sm outline-none" />
          <Command.List className="max-h-64 overflow-auto">
            <Command.Empty className="px-2 py-3 text-sm text-muted">Nothing matches.</Command.Empty>
            {items.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => {
                  item.onSelect()
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-surface-2"
              >
                <span>{item.label}</span>
                {item.hint ? <span className="text-xs text-muted">{item.hint}</span> : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </Dialog>
    </CommandCtx.Provider>
  )
}

export function useCommand() {
  return useContext(CommandCtx)
}

export function Select({ value, onValueChange, options, label }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  const current = options.find((o) => o.value === value)
  return (
    <Dropdown
      trigger={
        <button type="button" aria-label={label} className="inline-flex h-10 min-w-36 items-center justify-between gap-2 rounded-sm border border-line bg-surface-1 px-3 text-sm">
          {current?.label ?? value}
          <ChevronDown className="size-4 text-muted" />
        </button>
      }
    >
      {options.map((o) => (
        <DropdownItem key={o.value} onSelect={() => onValueChange(o.value)}>
          {o.label}
        </DropdownItem>
      ))}
    </Dropdown>
  )
}

export function Toaster() {
  return <Sonner theme="system" position="bottom-right" />
}

export { toast }

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action}
    </div>
  )
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 p-5" role="alert">
      <p className="font-medium text-danger">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {onRetry ? (
        <Button className="mt-3" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 mb-3 text-sm text-muted">{description}</p> : <div className="mb-3" />}
      <div className="divide-y divide-line rounded-lg border border-line bg-surface-1">{children}</div>
    </section>
  )
}

export function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium break-words">{label}</p>
        {hint ? <p className="text-xs leading-relaxed break-words text-muted">{hint}</p> : null}
      </div>
      <div className="max-w-full">{children}</div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <header className="mb-8">
      {eyebrow ? <p className="mb-2 text-xs tracking-[0.18em] text-muted uppercase">{eyebrow}</p> : null}
      <h1 className="text-[clamp(1.75rem,7vw,3rem)] font-semibold tracking-tight break-words">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{lead}</p> : null}
    </header>
  )
}

export function Lightbox({ src, alt, caption, onClose, fileName, kind = 'image', onDownload }: { src: string; alt: string; caption?: string; onClose: () => void; fileName?: string; kind?: 'image' | 'video'; onDownload?: () => void }) {
  const { t } = useTranslation('common')
  const shared = useRef<File | null>(null)
  useEffect(() => {
    let gone = false
    shared.current = null
    const name = fileName || alt || 'file'
    const type = kind === 'video' ? 'video/mp4' : 'image/jpeg'
    void fetch(src)
      .then((res) => res.blob())
      .then((blob) => {
        if (!gone) shared.current = new File([blob], name, { type: blob.type || type })
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [src, fileName, alt, kind])
  function shareFailed(err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    toast(t('shareUnavailable'))
  }
  function share() {
    const file = shared.current
    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        void navigator.share({ files: [file], title: file.name }).catch(shareFailed)
        return
      }
    } catch (err) {
      shareFailed(err)
      return
    }
    if (navigator.share && /^https?:/i.test(src)) {
      void navigator.share({ title: fileName || alt || 'file', url: src }).catch(shareFailed)
      return
    }
    toast(t('shareUnavailable'))
  }
  function download() {
    const link = document.createElement('a')
    link.href = src
    link.download = fileName || alt || 'file'
    document.body.appendChild(link)
    link.click()
    link.remove()
    onDownload?.()
  }
  return (
    <DialogPrimitive.Root open onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(15,25,35,0.92)]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-none outline-none"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <DialogPrimitive.Title className="sr-only">{caption || alt}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-10 flex size-11 items-center justify-center rounded-full border border-white/25 bg-[rgba(15,25,35,0.75)] text-white" aria-label={t('close')}>
            <X className="size-5" />
          </DialogPrimitive.Close>
          <figure className="pointer-events-none m-0 flex max-h-[92dvh] max-w-[min(96vw,120rem)] flex-col items-center gap-3">
            {kind === 'video' ? (
              <video src={src} controls playsInline className="pointer-events-auto max-h-[calc(92dvh-6rem)] max-w-full rounded-md bg-black" />
            ) : (
              <img src={src} alt={alt} className="pointer-events-auto max-h-[calc(92dvh-6rem)] max-w-full rounded-md object-contain shadow-float" />
            )}
            {caption ? <figcaption className="pointer-events-auto max-w-prose text-center text-sm text-[#e8eef2]">{caption}</figcaption> : null}
            {fileName ? (
              <div className="pointer-events-auto flex gap-2">
                <button type="button" className="h-11 rounded-full border border-white/25 bg-[rgba(15,25,35,0.75)] px-4 text-sm text-white" onClick={() => void share()}>{t('share')}</button>
                <button type="button" className="h-11 rounded-full border border-white/25 bg-[rgba(15,25,35,0.75)] px-4 text-sm text-white" onClick={download}>{t('download')}</button>
              </div>
            ) : null}
          </figure>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
