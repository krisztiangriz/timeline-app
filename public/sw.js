const CACHE_NAME = 'timeline-v4'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Only cache same-origin
  if (url.origin !== self.location.origin) return

  // Don't intercept SPA navigation — let React Router handle it
  if (event.request.mode === 'navigate') return

  // Skip non-cacheable dev/dynamic resources
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules') ||
    url.pathname.includes('.hot-update.') ||
    url.pathname.startsWith('/src/') ||
    url.search.includes('t=') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached)

      return cached || fetched
    })
  )
})
