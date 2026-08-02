// Firebase Cloud Messaging Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCD8513LiJf4mfbJ49UC-oQYT_Z7gQVcGs",
  authDomain: "pascaleducationmanager.firebaseapp.com",
  projectId: "pascaleducationmanager",
  storageBucket: "pascaleducationmanager.firebasestorage.app",
  messagingSenderId: "625010575702",
  appId: "1:625010575702:web:d27ac0eb436b628a08eef7"
});

const messaging = firebase.messaging();

// Xử lý sự kiện nhận thông báo đẩy khi App bị ĐÓNG / chạy ngầm
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background Push Received:', payload);

  const pushTitle = payload.notification?.title || payload.data?.title || '🔔 Thông báo từ PEM Pascal';
  const pushMessage = payload.notification?.body || payload.data?.message || payload.data?.body || 'Bạn vừa nhận được 1 thông báo mới từ hệ thống.';

  const options = {
    body: pushMessage,
    icon: '/logo-pascal-01.png',
    badge: '/logo-pascal-01.png',
    sound: '/sounds/notification.wav',
    vibrate: [500, 200, 500, 200, 500],
    tag: payload.data?.tag || `pem-${Date.now()}`,
    renotify: true,
    data: {
      url: payload.data?.link || payload.data?.url || '/dashboard/evaluations'
    },
    actions: [
      { action: 'open', title: 'Xem chi tiết' },
      { action: 'close', title: 'Đóng' }
    ]
  };

  self.registration.showNotification(pushTitle, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
