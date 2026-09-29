self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return
  if (event.data.type === 'notify-pref') {
    event.waitUntil(
      caches.open('ma-prefs').then((cache) => {
        const body = JSON.stringify({
          hideSender: !!event.data.hideSender,
          hideBody: !!event.data.hideBody,
        })
        return cache.put('/notify-pref', new Response(body))
      }),
    )
  }
})

self.addEventListener('push', (event) => {
  const ru = (self.navigator.language || '').toLowerCase().startsWith('ru')
  let count = 1
  try {
    const data = event.data ? event.data.json() : {}
    if (typeof data.n === 'number') count = data.n
  } catch {
    count = 1
  }
  const title = count > 1 ? (ru ? `Новые сообщения (${count})` : `New messages (${count})`) : (ru ? 'Новое сообщение' : 'New message')
  const body = ru ? 'Откройте чат, чтобы прочитать.' : 'Open chat to read it.'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: 'ma-mail',
      renotify: true,
      icon: '/web-app-manifest-192x192.png',
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              return client.navigate(target)
            } catch {
              /* open below */
            }
          }
          return undefined
        }
      }
      if (clients.openWindow) return clients.openWindow(target)
      return undefined
    }),
  )
})
