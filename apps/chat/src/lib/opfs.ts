export type OpfsKind = 'attachments' | 'pending' | 'sync-temp' | 'files'

async function digestName(userId: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export function opfsAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.getDirectory === 'function'
}

async function accountDirectory(userId: string, create: boolean) {
  const root = await navigator.storage.getDirectory()
  const users = await root.getDirectoryHandle('users', { create })
  return users.getDirectoryHandle(await digestName(userId), { create })
}

export async function userDirectory(userId: string, kind: OpfsKind) {
  const account = await accountDirectory(userId, true)
  return account.getDirectoryHandle(kind, { create: true })
}

export async function writeNamed(userId: string, kind: OpfsKind, name: string, bytes: Uint8Array) {
  const dir = await userDirectory(userId, kind)
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  await writable.write(buffer)
  await writable.close()
}

export async function readNamed(userId: string, kind: OpfsKind, name: string) {
  const dir = await userDirectory(userId, kind)
  const handle = await dir.getFileHandle(name)
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

/** Open a streaming writer. Call `close()` to keep the file or `abort()` to drop it. */
export async function openWriter(userId: string, kind: OpfsKind, name: string) {
  const dir = await userDirectory(userId, kind)
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable({ keepExistingData: false })
  return {
    write: async (chunk: Uint8Array) => {
      const buffer = new ArrayBuffer(chunk.byteLength)
      new Uint8Array(buffer).set(chunk)
      await writable.write(buffer)
    },
    close: () => writable.close(),
    abort: async () => {
      await writable.abort().catch(() => undefined)
      await dir.removeEntry(name).catch(() => undefined)
    },
  }
}

export async function openNamed(userId: string, kind: OpfsKind, name: string): Promise<File | undefined> {
  try {
    const dir = await userDirectory(userId, kind)
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch {
    return undefined
  }
}

export async function removeNamed(userId: string, kind: OpfsKind, name: string) {
  try {
    const dir = await userDirectory(userId, kind)
    await dir.removeEntry(name)
  } catch {
    // already gone
  }
}

export async function listNamed(userId: string, kind: OpfsKind) {
  const out: string[] = []
  try {
    const dir = await userDirectory(userId, kind)
    for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) out.push(name)
  } catch {
    // no directory yet
  }
  return out
}

/** Drop whole scratch directories left by older builds. */
export async function removeKind(userId: string, kind: OpfsKind) {
  try {
    const account = await accountDirectory(userId, false)
    await account.removeEntry(kind, { recursive: true })
  } catch {
    // nothing to remove
  }
}

/** Remove every OPFS entry this origin owns. Used by the "delete all local data" action. */
export async function wipeOpfs() {
  if (!opfsAvailable()) return
  try {
    const root = await navigator.storage.getDirectory()
    for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
      await root.removeEntry(name, { recursive: true }).catch(() => undefined)
    }
  } catch {
    // OPFS unavailable
  }
}
