import { passwordError } from '@ma/protocol'
import { Button, Input, PageHeader } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function UnlockScreen({
  onUnlock,
  onImport,
  showImport,
}: {
  onUnlock: (password: string) => Promise<void>
  onImport: (password: string) => Promise<void>
  showImport: boolean
}) {
  const { t } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [legacy, setLegacy] = useState('')
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 overflow-y-auto px-4 py-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (passwordError(password)) return
          void onUnlock(password)
        }}
      >
        <PageHeader title={t('unlockChat')} lead={t('unlockLead')} />
        <p className="text-xs text-muted">{t('vaultPasswordSeparate')}</p>
        <Input type="password" placeholder={t('vaultPassword')} aria-label={t('vaultPassword')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit">{t('unlock')}</Button>
      </form>
      {showImport ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void onImport(legacy)
          }}
        >
          <p className="text-sm">{t('legacyVault')}</p>
          <Input type="password" placeholder={t('legacyVaultPassword')} aria-label={t('legacyVaultPassword')} value={legacy} onChange={(e) => setLegacy(e.target.value)} />
          <Button type="submit" variant="outline">{t('importVault')}</Button>
        </form>
      ) : null}
    </div>
  )
}
