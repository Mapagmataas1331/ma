import type { ComponentType } from 'react'

/** Lazy loader for the account settings panel; hand it to `<AppShell account={…}>` to show the settings gear. */
export type AccountLoader = () => Promise<{ AccountSettings: ComponentType }>

// Keeps api-client, zod and the account UI in their own chunk, fetched on the gear's first hover/focus/open.
export const loadAccountSettings: AccountLoader = () => import('./account-settings')
