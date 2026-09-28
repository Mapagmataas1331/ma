import { decryptRecord, deriveKek, ready, unb64, unwrapDek, type WrappedSlot } from '@ma/crypto'
import { activeDatabase, legacyDatabase } from './db'

type IdentityKeys = { signPk: string; signSk: string; boxPk: string; boxSk: string }

export async function legacyIdentity(password: string): Promise<IdentityKeys | null> {
  await ready()
  const db = legacyDatabase()
  await db.open()
  try {
    const vault = await db.vault.get('main')
    const slot = ((vault?.slots ?? []) as WrappedSlot[]).find((item) => item.kind === 'password')
    const row = await db.records.get('identity')
    if (!slot || !row) return null
    const dek = unwrapDek(deriveKek(password, slot.kdf), slot)
    return decryptRecord<IdentityKeys>(dek, 'identity', 'keys', row.nonce, row.ciphertext)
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function copyLegacyVault(password: string, userId: string, serverX25519: string) {
  const keys = await legacyIdentity(password)
  if (!keys || (serverX25519 && keys.boxPk !== serverX25519)) return false
  const source = legacyDatabase()
  await source.open()
  try {
    const target = activeDatabase()
    if ((await target.vault.get('main'))?.ownerUserId && (await target.vault.get('main'))?.ownerUserId !== userId) return false
    await target.transaction('rw', target.vault, target.records, target.outbox, target.files, async () => {
      const vault = await source.vault.get('main')
      if (vault) await target.vault.put({ ...vault, ownerUserId: userId })
      await target.records.bulkPut(await source.records.toArray())
      await target.outbox.bulkPut(await source.outbox.toArray())
      await target.files.bulkPut(await source.files.toArray())
    })
    const copied = await target.records.count()
    return copied === (await source.records.count())
  } finally {
    source.close()
  }
}

export function legacyKeyMatches(keys: IdentityKeys | null, serverX25519: string) {
  if (!keys) return false
  if (!serverX25519) return true
  return keys.boxPk === serverX25519 && unb64(keys.boxPk).byteLength === 32
}
