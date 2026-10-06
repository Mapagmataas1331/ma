import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Lives outside account-settings.tsx so AppShell can provide the slot without loading the account panel (api-client, zod) up front.

export const AppSettingsSlot = createContext<{ slot: HTMLElement | null; setSlot: (node: HTMLElement | null) => void }>({
  slot: null,
  setSlot: () => {},
})

export function AppSettings({ children }: { children: ReactNode }) {
  const { slot } = useContext(AppSettingsSlot)
  if (!slot) return null
  return createPortal(children, slot)
}
