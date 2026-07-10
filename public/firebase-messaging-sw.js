// Standard Web Push service worker — no Firebase SDK needed
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'SplitMonk', body: event.data.text(), data: {} }
  }

  const title = payload.title ?? 'SplitMonk'
  const body  = payload.body  ?? ''
  const data  = payload.data  ?? {}

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  payload.icon  ?? '/icons/icon-192.png',
      badge: payload.badge ?? '/icons/icon-192.png',
      tag:   payload.tag   ?? 'splitmonk',
      data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      return clients.openWindow(url)
    })
  )
})
