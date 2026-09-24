const CACHE = 'frozen-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/index.html', '/manifest.webmanifest'])))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    caches.match(e.request).then(
      hit =>
        hit ||
        fetch(e.request)
          .then(res => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then(c => c.put(e.request, copy))
            }
            return res
          })
          .catch(() =>
            e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error(),
          ),
    ),
  )
})
