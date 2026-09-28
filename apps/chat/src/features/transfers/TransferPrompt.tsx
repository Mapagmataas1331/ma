import { Button, Dialog, Input } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function TransferPrompt({
  open,
  onTransfer,
  onFresh,
  onLater,
}: {
  open: boolean
  onTransfer: (pairingId: string, code: string, vaultPassword: string) => Promise<void>
  onFresh: () => void
  onLater: () => void
}) {
  const { t } = useTranslation('common')
  const [pairingId, setPairingId] = useState('')
  const [code, setCode] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onLater() }} title={t('transferAsk')} description={t('transferAskLead')}>
      <div className="flex flex-col gap-3">
        <Input placeholder={t('pairingId')} aria-label={t('pairingId')} value={pairingId} onChange={(e) => setPairingId(e.target.value)} />
        <Input placeholder={t('pairingCode')} aria-label={t('pairingCode')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Input type="password" placeholder={t('vaultPassword')} aria-label={t('vaultPassword')} value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} />
        <Button type="button" onClick={() => void onTransfer(pairingId.trim(), code.trim(), vaultPassword)}>{t('transferChats')}</Button>
        <Button type="button" variant="outline" onClick={onFresh}>{t('startFresh')}</Button>
        <Button type="button" variant="ghost" onClick={onLater}>{t('notNow')}</Button>
      </div>
    </Dialog>
  )
}
