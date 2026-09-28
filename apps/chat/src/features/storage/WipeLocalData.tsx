import { Button, Dialog, SettingsRow, SettingsSection, toast } from '@ma/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { wipeLocalData } from '../../lib/wipe'

/**
 * "Delete everything this browser knows about chat.ma.cyou". Rendered in settings on every screen,
 * including before the vault is unlocked and before sign-in, so a stuck install can always be reset.
 */
export function WipeLocalData({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <SettingsSection title={t('localData')} description={t('localDataLead')}>
      {children}
      <SettingsRow label={t('wipeLocal')} hint={t('wipeLocalHint')}>
        <Button type="button" variant="danger" onClick={() => setOpen(true)}>{t('wipeLocal')}</Button>
      </SettingsRow>
      <Dialog open={open} onOpenChange={setOpen} title={t('wipeLocal')} description={t('wipeLocalConfirm')}>
        <div className="flex flex-col gap-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t('wipeItemChats')}</li>
            <li>{t('wipeItemFiles')}</li>
            <li>{t('wipeItemLegacy')}</li>
            <li>{t('wipeItemCache')}</li>
          </ul>
          <p className="text-sm text-muted">{t('wipeKeepsAccount')}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t('cancel')}</Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void wipeLocalData()
                  .catch((err) => toast(err instanceof Error ? err.message : t('somethingWentWrong')))
                  .finally(() => {
                    location.replace('/')
                  })
              }}
            >
              {busy ? t('wiping') : t('wipeNow')}
            </Button>
          </div>
        </div>
      </Dialog>
    </SettingsSection>
  )
}
