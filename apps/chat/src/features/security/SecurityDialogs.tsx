import { ApiError, api } from '@ma/api-client'
import { Button, Dialog, Input, toast } from '@ma/ui'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/** Shows a freshly created recovery key once, with a copy button, instead of a disappearing toast. */
export function RecoveryKeyDialog({ value, onClose }: { value: string; onClose: () => void }) {
  const { t } = useTranslation('common')
  return (
    <Dialog open={!!value} onOpenChange={(open) => { if (!open) onClose() }} title={t('recoveryKey')} description={t('recoveryKeyLead')}>
      <div className="flex flex-col gap-3">
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm break-all select-all">{value}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void copyText(value).then((ok) => toast(ok ? t('copied') : t('copyFailed')))}>{t('copy')}</Button>
          <Button type="button" onClick={onClose}>{t('savedIt')}</Button>
        </div>
      </div>
    </Dialog>
  )
}

type TotpSetup = { otpauth_url?: string; secret?: string }

/** Full TOTP enrolment: QR + secret, confirm with a code, then show recovery codes once. */
export function TotpDialog({ open, onOpenChange, onEnabled }: { open: boolean; onOpenChange: (open: boolean) => void; onEnabled: () => void }) {
  const { t } = useTranslation('common')
  const [setup, setSetup] = useState<TotpSetup | null>(null)
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setSetup(null)
      setQr('')
      setCode('')
      setCodes([])
      return
    }
    let cancelled = false
    void api<TotpSetup>('/v1/auth/2fa/totp/setup', { method: 'POST' })
      .then(async (res) => {
        if (cancelled) return
        setSetup(res)
        if (res.otpauth_url) setQr(await QRCode.toDataURL(res.otpauth_url))
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : t('somethingWentWrong'))
        onOpenChange(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, onOpenChange, t])

  async function confirm() {
    setBusy(true)
    try {
      const res = await api<{ recovery_codes?: string[] }>('/v1/auth/2fa/totp/confirm', { method: 'POST', body: JSON.stringify({ code: code.trim() }) })
      setCodes(res.recovery_codes ?? [])
      onEnabled()
    } catch (err) {
      toast(err instanceof ApiError && err.code === 'invalid_code' ? t('codeWrong') : err instanceof Error ? err.message : t('somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('twoFactor')} description={codes.length ? t('recoveryCodesLead') : t('totpLead')}>
      {codes.length ? (
        <div className="flex flex-col gap-3">
          <ul className="grid grid-cols-2 gap-1 rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm">
            {codes.map((item) => (
              <li key={item} className="select-all">{item}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void copyText(codes.join('\n')).then((ok) => toast(ok ? t('copied') : t('copyFailed')))}>{t('copy')}</Button>
            <Button type="button" onClick={() => onOpenChange(false)}>{t('savedIt')}</Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim().length >= 6) void confirm()
          }}
        >
          {qr ? <img src={qr} alt={t('totpQr')} className="mx-auto size-44 rounded-md bg-white p-2" /> : <div className="mx-auto size-44 animate-pulse rounded-md bg-surface-3" />}
          {setup?.secret ? (
            <p className="text-center text-xs text-muted">
              {t('totpSecret')} <span className="font-mono select-all">{setup.secret}</span>
            </p>
          ) : null}
          <Input inputMode="numeric" autoComplete="one-time-code" placeholder={t('code')} aria-label={t('code')} value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" disabled={busy || code.trim().length < 6}>{t('enableTwoFactor')}</Button>
        </form>
      )}
    </Dialog>
  )
}
