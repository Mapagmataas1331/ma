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
  event.waitUntil((async () => {
    const cached = await caches.open('ma-prefs').then((cache) => cache.match('/notify-pref')).catch(() => undefined)
    const show = cached ? (await cached.text()) === '1' : false
    const title = show ? (count > 1 ? (ru ? `Новые сообщения (${count})` : `New messages (${count})`) : (ru ? 'Новое сообщение' : 'New message')) : 'ma.cyou'
    const body = ru ? 'Откройте чат, чтобы прочитать.' : 'Open chat to read it.'
    await self.registration.showNotification(title, { body: show ? body : '', data: { url: '/' } })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
