self.addEventListener('push', (event) => {
  let count = 1
  try {
    const data = event.data ? event.data.json() : {}
    if (typeof data.n === 'number') count = data.n
  } catch {
    count = 1
  }
  const title = count > 1 ? `New messages (${count})` : 'New message'
  event.waitUntil(self.registration.showNotification(title, { body: 'Open chat to read it.', data: { url: '/' } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
