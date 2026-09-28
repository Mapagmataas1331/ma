import { api } from '@ma/api-client'
import { Button } from '@ma/ui'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

type Device = { id: string; name: string; platform: string; trust_state: string; current?: boolean }

export function DeviceList({ enabled, userId }: { enabled: boolean; userId: string }) {
  const { t } = useTranslation('common')
  const query = useQuery({
    queryKey: ['devices', userId],
    enabled: enabled && !!userId,
    queryFn: () => api<Device[]>('/v1/devices'),
  })
  if (!query.data?.length) return null
  return (
    <ul className="space-y-2 px-4 py-2 text-sm">
      {query.data.map((device) => (
        <li key={device.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{device.current ? t('thisDevice') : device.name || device.platform}</span>
          <span className="text-xs text-muted">{t(device.trust_state === 'trusted' ? 'trusted' : device.trust_state === 'revoked' ? 'revoked' : 'pending')}</span>
          {!device.current && device.trust_state !== 'revoked' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void api(`/v1/devices/${device.id}/revoke`, { method: 'POST', body: JSON.stringify({ confirm_last: false }) }).then(() => query.refetch())}
            >
              {t('revoke')}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
