import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

// Kept apart from primitives.tsx so the always-visible header can use buttons without pulling every Radix primitive into the entry chunk.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'icon'
  asChild?: boolean
}

const buttonClass = {
  base: 'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-center leading-tight font-medium transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  primary: 'bg-accent text-accent-fg shadow-float hover:-translate-y-0.5 hover:shadow-md',
  ghost: 'bg-transparent text-fg hover:-translate-y-0.5 hover:bg-surface-2',
  outline: 'border border-line bg-surface-1 text-fg hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-sm',
  danger: 'bg-danger text-white hover:-translate-y-0.5 hover:shadow-md',
  sm: 'min-h-8 h-auto px-3 py-1.5 text-sm',
  md: 'min-h-10 h-auto px-4 py-2 text-sm',
  icon: 'size-10',
}

export function Button({ className, variant = 'primary', size = 'md', asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonClass.base, buttonClass[variant], buttonClass[size], className)} {...props} />
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <Button variant="ghost" size="icon" aria-label={label} className={className} {...props} />
}
