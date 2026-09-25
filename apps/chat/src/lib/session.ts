import { create } from 'zustand'

type Session = {
  user: { id: string; username: string; display_name: string } | null
  deviceId: string | null
  trust: string | null
  setSession: (user: Session['user'], deviceId: string | null, trust: string | null) => void
  clear: () => void
}

export const useSession = create<Session>((set) => ({
  user: null,
  deviceId: null,
  trust: null,
  setSession: (user, deviceId, trust) => set({ user, deviceId, trust }),
  clear: () => set({ user: null, deviceId: null, trust: null }),
}))

const DEVICE_KEY = 'ma.device.pks'

export function loadDevicePublicKeys(): { ed25519: string; x25519: string } | null {
  const raw = localStorage.getItem(DEVICE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as { ed25519: string; x25519: string }
}

export function saveDevicePublicKeys(keys: { ed25519: string; x25519: string }) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify(keys))
}
