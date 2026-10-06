import { accountKey } from './db'

export type ChatPref = { pinned?: boolean; pinnedAt?: number; muted?: boolean }

export function loadPrefs(userId: string): Record<string, ChatPref> {
  if (!userId) return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(accountKey(userId, 'prefs')) || '{}') as Record<string, ChatPref>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function savePrefs(userId: string, next: Record<string, ChatPref>) {
  if (!userId) return
  localStorage.setItem(accountKey(userId, 'prefs'), JSON.stringify(next))
}

export function loadStorageGb(userId: string) {
  const raw = userId ? localStorage.getItem(accountKey(userId, 'storageGb')) : null
  if (raw === null || raw === '') return 5
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 5
}

export function saveStorageGb(userId: string, gb: number) {
  if (userId) localStorage.setItem(accountKey(userId, 'storageGb'), String(gb))
}

export function transferDismissed(userId: string) {
  return localStorage.getItem(accountKey(userId, 'transfer.dismissed')) === '1'
}

export function dismissTransfer(userId: string) {
  localStorage.setItem(accountKey(userId, 'transfer.dismissed'), '1')
}

export function clearTransferDismissal(userId: string) {
  localStorage.removeItem(accountKey(userId, 'transfer.dismissed'))
}
