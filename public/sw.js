/* GymBook service worker: keeps the app shell available offline.
   Data never goes through here; it lives in IndexedDB. */
const VERSION = 'gymbook-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']
// Filled in by scripts/inject-sw.mjs after `vite build`.
const PRECACHE = []

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([...SHELL, ...PRECACHE])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // App navigations: network first, fall back to the cached shell so the app opens offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Hashed build assets and fonts: cache first (they never change under the same name).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(VERSION).then((c) => c.put(req, copy))
        return res
      })),
    )
    return
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(VERSION).then((c) => c.put(req, copy))
        return res
      }).catch(() => hit)
      return hit || network
    }),
  )
})
