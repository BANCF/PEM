// Pascal Education Manager - Service Worker for Background Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Xử lý sự kiện Push Notification khi App/Trình duyệt đóng hoàn toàn
self.addEventListener('push', (event) => {
  let data = { title: 'Thông báo PEM Pascal', message: 'Bạn có thông báo mới từ hệ thống.', link: '/dashboard/evaluations' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.message = event.data.text();
    }
  }

  const options = {
    body: data.message || data.body,
    icon: '/logo-pascal-01.png',
    badge: '/logo-pascal-01.png',
    vibrate: [300, 100, 300, 100, 300], // Rung máy trên điện thoại
    tag: data.tag || 'pem-notification',
    renotify: true,
    data: {
      url: data.link || data.url || '/dashboard/evaluations'
    },
    actions: [
      { action: 'open', title: 'Xem chi tiết' },
      { action: 'close', title: 'Đóng' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PEM Pascal', options)
  );
});

// Xử lý khi người dùng chạm vào thông báo trên thanh thông báo điện thoại
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
