import { vaultPasswordError } from '@ma/protocol'
import { Button, Input, PageHeader } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function VaultExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation('common')
  return (
    <details className="rounded-md border border-line bg-surface-1 px-4 py-3 text-sm" open={defaultOpen}>
      <summary className="cursor-pointer font-medium">{t('vaultWhatIs')}</summary>
      <div className="mt-3 space-y-3 text-muted">
        <p>{t('vaultExplainWhat')}</p>
        <p>{t('vaultExplainWhy')}</p>
        <p>{t('vaultExplainForget')}</p>
      </div>
    </details>
  )
}

export function UnlockScreen({
  mode,
  onUnlock,
  pending = false,
  onTransfer,
  onFresh,
}: {
  /** `create` when this account has no vault on this device yet. */
  mode: 'create' | 'unlock'
  onUnlock: (password: string) => Promise<void>
  /** This device cannot open chats until it transfers from a trusted device or starts fresh. */
  pending?: boolean
  onTransfer?: () => void
  onFresh?: (password: string) => void
}) {
  const { t } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const creating = mode === 'create'
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 overflow-y-auto px-4 py-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const problem = vaultPasswordError(password)
          if (problem) {
            setError(problem)
            return
          }
          if (creating && password !== confirm) {
            setError(t('vaultPasswordsDiffer'))
            return
          }
          setError('')
          void onUnlock(password)
        }}
      >
        <PageHeader title={creating ? t('createVault') : t('unlockChat')} lead={creating ? t('createVaultLead') : t('unlockLead')} />
        <Input
          type="password"
          placeholder={creating ? t('newVaultPassword') : t('vaultPassword')}
          aria-label={t('vaultPassword')}
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {creating ? (
          <Input type="password" placeholder={t('repeatVaultPassword')} aria-label={t('repeatVaultPassword')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit">{creating ? t('createVaultButton') : t('unlock')}</Button>
        {creating ? <p className="text-xs text-muted">{t('vaultNotAccountPassword')}</p> : null}
      </form>
      {pending && onTransfer && onFresh ? (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-1 px-4 py-3">
          <p className="text-sm">{t('deviceUntrusted')}</p>
          <Button type="button" onClick={onTransfer}>{t('transferChats')}</Button>
          <Button type="button" variant="outline" onClick={() => {
            const problem = vaultPasswordError(password)
            if (problem) {
              setError(problem)
              return
            }
            if (creating && password !== confirm) {
              setError(t('vaultPasswordsDiffer'))
              return
            }
            setError('')
            void onFresh(password)
          }}>{t('startFresh')}</Button>
        </div>
      ) : null}
      <VaultExplainer defaultOpen={creating} />
    </div>
  )
}
