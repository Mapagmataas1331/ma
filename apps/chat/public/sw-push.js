self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'notify-pref') {
    event.waitUntil(caches.open('ma-prefs').then((cache) => cache.put('/notify-pref', new Response(event.data.show ? '1' : '0'))))
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
  event.waitUntil(self.registration.showNotification(title, { body, data: { url: '/' } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
