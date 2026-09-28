async function digestName(userId: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export async function userDirectory(userId: string, kind: 'attachments' | 'pending' | 'sync-temp') {
  const root = await navigator.storage.getDirectory()
  const users = await root.getDirectoryHandle('users', { create: true })
  const account = await users.getDirectoryHandle(await digestName(userId), { create: true })
  return account.getDirectoryHandle(kind, { create: true })
}

export async function writeNamed(userId: string, kind: 'attachments' | 'pending' | 'sync-temp', name: string, bytes: Uint8Array) {
  const dir = await userDirectory(userId, kind)
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  await writable.write(buffer)
  await writable.close()
}

export async function readNamed(userId: string, kind: 'attachments' | 'pending' | 'sync-temp', name: string) {
  const dir = await userDirectory(userId, kind)
  const handle = await dir.getFileHandle(name)
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}
