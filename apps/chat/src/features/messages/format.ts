export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function statusLabel(status: string, translate: (key: string) => string) {
  if (status === 'sending' || status === 'queued' || status === 'connecting') return translate('statusSending')
  if (status === 'sent' || status === 'stored' || status === 'mailboxing' || status === 'sending_p2p') return translate('statusSent')
  if (status === 'waiting_peer') return translate('waitingPeer')
  if (status === 'delivered') return translate('statusDelivered')
  if (status === 'read') return translate('statusRead')
  if (status === 'failed') return translate('statusFailed')
  if (status === 'expired') return translate('statusExpired')
  if (status === 'cancelled') return translate('cancelled')
  return status
}
