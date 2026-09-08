const CACHE = 'tracker116-v2.0';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './program.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './rest-whistle-v13.wav'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});


self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  const title = data.title || 'Отдых закончен';
  const options = {
    body: data.body || 'Пора начинать следующий подход.',
    tag: data.tag || 'tracker116-rest',
    renotify: true,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async()=>{
    const all = await clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of all) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
  })());
});
