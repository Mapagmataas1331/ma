import { ApiError, api } from '@ma/api-client'
import { Button, toast } from '@ma/ui'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

type Device = { id: string; name: string; platform: string; trust_state: string; current?: boolean; last_seen_at?: string | null }

export function DeviceList({ enabled, userId }: { enabled: boolean; userId: string }) {
  const { t } = useTranslation('common')
  const query = useQuery({
    queryKey: ['devices', userId],
    enabled: enabled && !!userId,
    queryFn: () => api<Device[]>('/v1/devices'),
  })

  async function revoke(device: Device, confirmLast = false) {
    try {
      await api(`/v1/devices/${device.id}/revoke`, { method: 'POST', body: JSON.stringify({ confirm_last: confirmLast }) })
      await query.refetch()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'last_trusted_device' && !confirmLast) {
        if (window.confirm(t('revokeLastConfirm'))) await revoke(device, true)
        return
      }
      toast(err instanceof Error ? err.message : t('somethingWentWrong'))
    }
  }

  if (query.isError) {
    return <p className="px-4 py-2 text-sm text-danger">{t('devicesLoadFailed')}</p>
  }
  if (query.isLoading) return null
  if (!query.data?.length) {
    return <p className="px-4 py-2 text-sm text-muted">{t('noDevicesYet')}</p>
  }

  return (
    <ul className="divide-y divide-line text-sm">
      {query.data.map((device) => (
        <li key={device.id} className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate">{device.current ? t('thisDevice') : device.name || device.platform}</span>
            <span className="block text-xs text-muted">
              {t(device.trust_state === 'trusted' ? 'trusted' : device.trust_state === 'revoked' ? 'revoked' : 'pending')}
              {device.last_seen_at && !device.current ? ` · ${t('lastSeen', { date: new Date(device.last_seen_at).toLocaleDateString() })}` : ''}
            </span>
          </span>
          {!device.current && device.trust_state !== 'revoked' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void revoke(device)}>
              {t('revoke')}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
