importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyDdwgBpj9SpC1XFiaCJ7hvStrpa0scH-iY',
  authDomain:        'splitmonk-007.firebaseapp.com',
  projectId:         'splitmonk-007',
  storageBucket:     'splitmonk-007.firebasestorage.app',
  messagingSenderId: '746882858752',
  appId:             '1:746882858752:web:1d5b7d8d12fdeef70c3de5',
})

const messaging = firebase.messaging()

// Background push — fires when the app tab is closed or not focused
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'SplitMonk'
  const body  = payload.notification?.body  ?? ''
  const data  = payload.data ?? {}

  self.registration.showNotification(title, {
    body,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   data.type ?? 'splitmonk', // same tag replaces previous notification of same type
    data,
  })
})

// Notification click — open/focus the app at the correct deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.link
    ?? event.notification.data?.url
    ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If app is already open in a tab, focus it and navigate
      for (const client of list) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url)
    })
  )
})
