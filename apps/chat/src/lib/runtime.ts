import { closeAccount } from './db'
import { clearDeviceSecrets } from './device'
import { useSession } from './session'
import { transport } from './transport'
import { lockVault } from './vault'

const urls = new Set<string>()
let abort: AbortController | null = null

export function trackObjectUrl(url: string) {
  urls.add(url)
  return url
}

export function runtimeSignal() {
  abort?.abort()
  abort = new AbortController()
  return abort.signal
}

export function resetChatRuntime() {
  lockVault()
  transport.disconnect()
  clearDeviceSecrets()
  abort?.abort()
  abort = null
  for (const url of urls) URL.revokeObjectURL(url)
  urls.clear()
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('ma.chat.') && key.endsWith('.device.pks')) sessionStorage.removeItem(key)
  }
  useSession.getState().clear()
  void closeAccount()
}
