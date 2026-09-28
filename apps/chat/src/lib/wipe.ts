import Dexie from 'dexie'
import { closeAccount, databaseNames } from './db'
import { wipeOpfs } from './opfs'
import { resetChatRuntime } from './runtime'

/**
 * Remove everything chat.ma.cyou has ever stored in this browser profile: every account vault
 * (including the pre-account `ma-chat` database), OPFS blobs, preferences, service-worker caches,
 * and registered workers. The session cookie lives on the API origin and is cleared by signing out.
 */
export async function wipeLocalData() {
  resetChatRuntime()
  await closeAccount()
  const names = await databaseNames()
  const known = new Set([...names, 'ma-chat'])
  for (const name of known) {
    if (name === 'ma-chat' || name.startsWith('ma-chat-v2:') || name.startsWith('ma-chat')) {
      await Dexie.delete(name).catch(() => undefined)
    }
  }
  await wipeOpfs()
  try {
    localStorage.clear()
  } catch {
    // storage blocked
  }
  try {
    sessionStorage.clear()
  } catch {
    // storage blocked
  }
  if ('caches' in window) {
    const keys = await caches.keys().catch(() => [] as string[])
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
  }
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => [] as readonly ServiceWorkerRegistration[])
    await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)))
  }
}
