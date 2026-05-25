const CACHE_NAME = '__CACHE_NAME__'
const BASE = '__BASE__'
const PRECACHE_URLS = __PRECACHE_MANIFEST__

// ---- Install: precache all assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ---- Activate: delete old caches ----
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

// ---- Fetch: differentiated caching strategies ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Only cache same-origin
  if (url.origin !== self.location.origin) return

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

  // Navigation → serve cached index.html for SPA routing (handles 404 from GitHub Pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(BASE + 'index.html', clone))
            return response
          }
          // Non-OK (404) → serve cached index.html so React Router handles the route
          return caches.match(BASE + 'index.html') || response
        })
        .catch(() => caches.match(BASE + 'index.html'))
    )
    return
  }

  // Skip large media files — don't cache videos
  if (url.pathname.match(/\.(mp4|webm|ogg|mov)$/)) return

  // Hashed assets (Vite output) → cache-first, cache on first fetch for lazy chunks
  if (url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else → network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || new Response('', { status: 503 })))
  )
})
