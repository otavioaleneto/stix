self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'GodSend Stix', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  var options = {
    body: data.body || '',
    icon: data.icon || '/nova-webui/img/icon.nova.png',
    badge: data.badge || '/nova-webui/img/icon.nova.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.data && data.data.type ? data.data.type : 'default',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GodSend Stix', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = '/nova-webui/';
  var data = event.notification.data || {};

  if (data.type === 'room_invite' || data.type === 'room_reminder') {
    url = '/nova-webui/#rooms';
  } else if (data.type === 'friend_request') {
    url = '/nova-webui/#home';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf('/nova-webui') !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
