import { Check } from 'lucide-react'
import type { ReactElement } from 'react'
import { cn } from '../lib/cn'
import { Dropdown, DropdownItem } from './primitives'
import type { SiteLink } from './shell'

// Loaded on demand by AppShell (first hover, focus, or open), keeping Radix menus, dialogs and cmdk out of the entry chunk.

export { CommandDialog, Sheet } from './primitives'

export function SiteMenu({
  sites,
  label,
  trigger,
  open,
  onOpenChange,
}: {
  sites: SiteLink[]
  label: string
  trigger: ReactElement
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dropdown trigger={trigger} open={open} onOpenChange={onOpenChange}>
      <div className="px-2 py-1.5 text-[0.65rem] font-medium tracking-wide text-muted uppercase">{label}</div>
      {sites.map((site) => (
        <DropdownItem
          key={site.href + site.short}
          onSelect={() => {
            if (site.current) return
            window.location.assign(site.href)
          }}
        >
          <span className="flex w-full min-w-44 items-center gap-3">
            <span className={cn('w-16 shrink-0 font-mono text-xs', site.current ? 'text-accent' : 'text-muted')}>{site.short}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{site.label}</span>
            {site.current ? <Check className="size-3.5 shrink-0 text-accent" /> : null}
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  )
}
