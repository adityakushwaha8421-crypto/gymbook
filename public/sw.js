/* GymBook service worker: keeps the app shell available offline.
   Data never goes through here; it lives in IndexedDB. */
const VERSION = 'gymbook-shell-v1'
// The app may live under a sub-path (GitHub Pages project sites), so everything is relative to the scope.
const BASE = new URL(self.registration.scope).pathname
const SHELL = ['', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png'].map((p) => BASE + p)
// Filled in by scripts/inject-sw.mjs after `vite build` (paths relative to BASE).
const PRECACHE = []

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([...SHELL, ...PRECACHE.map((p) => BASE + p)])).then(() => self.skipWaiting()))
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
          caches.open(VERSION).then((c) => c.put(BASE, copy))
          return res
        })
        .catch(() => caches.match(BASE)),
    )
    return
  }

  // Hashed build assets and fonts: cache first (they never change under the same name).
  if (url.pathname.startsWith(BASE + 'assets/')) {
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
