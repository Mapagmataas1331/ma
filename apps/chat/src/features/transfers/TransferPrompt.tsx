import { vaultPasswordError } from '@ma/protocol'
import { Button, Dialog, Input } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export type TransferStatus = { step: 'waiting' | 'receiving' | 'done' | 'failed'; count?: number; error?: string }

export function TransferPrompt({
  open,
  onTransfer,
  onFresh,
  onLater,
  status,
  fingerprint,
  needPassword = true,
  allowFresh = true,
}: {
  open: boolean
  onTransfer: (pairingId: string, code: string, vaultPassword: string) => Promise<void>
  onFresh: (password: string) => void
  onLater: () => void
  /** Progress once the code was accepted. While waiting or receiving the form is replaced by a status line. */
  status?: TransferStatus | null
  /** Short code both devices show; the user compares them before confirming on the other device. */
  fingerprint?: string
  /** False when this device's vault is already open: the chats are merged into it and no new password is needed. */
  needPassword?: boolean
  allowFresh?: boolean
}) {
  const { t } = useTranslation('common')
  const [pairingId, setPairingId] = useState('')
  const [code, setCode] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const working = status?.step === 'waiting' || status?.step === 'receiving'

  async function submitTransfer() {
    if (needPassword) {
      const problem = vaultPasswordError(vaultPassword)
      if (problem) {
        setError(problem)
        return
      }
    }
    if (!pairingId.trim() || !code.trim()) {
      setError(t('pairingFieldsRequired'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await onTransfer(pairingId.trim(), code.trim(), vaultPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onLater() }} title={t('transferAsk')} description={working ? t('transferKeepOpen') : t('transferAskLead')}>
      {working ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" role="status" aria-live="polite">
            {status?.step === 'receiving' ? t('transferReceiving', { count: status.count ?? 0 }) : t('transferWaitingConfirm')}
          </p>
          {fingerprint ? <p className="text-xs text-muted">{t('transferCompare')} <span className="font-mono text-sm text-fg">{fingerprint}</span></p> : null}
          <Button type="button" variant="ghost" onClick={onLater}>{t('cancel')}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>{t('transferStep1')}</li>
            <li>{t('transferStep2')}</li>
            <li>{t('transferStep3')}</li>
          </ol>
          <Input placeholder={t('pairingId')} aria-label={t('pairingId')} value={pairingId} onChange={(e) => setPairingId(e.target.value)} disabled={busy} />
          <Input placeholder={t('pairingCode')} aria-label={t('pairingCode')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={busy} />
          {needPassword ? (
            <Input type="password" placeholder={t('vaultPassword')} aria-label={t('vaultPassword')} autoComplete="new-password" value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} disabled={busy} />
          ) : null}
          {needPassword ? <p className="text-xs text-muted">{t('transferPasswordHint')}</p> : null}
          {status?.step === 'failed' && status.error && !error ? <p className="text-sm text-danger" role="alert">{status.error}</p> : null}
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <Button type="button" disabled={busy} onClick={() => void submitTransfer()}>{t('transferChats')}</Button>
          {allowFresh ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => {
              const problem = vaultPasswordError(vaultPassword)
              if (problem) {
                setError(problem)
                return
              }
              setError('')
              onFresh(vaultPassword)
            }}>{t('startFresh')}</Button>
          ) : null}
          <Button type="button" variant="ghost" disabled={busy} onClick={onLater}>{t('notNow')}</Button>
        </div>
      )}
    </Dialog>
  )
}
