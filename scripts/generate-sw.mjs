/**
 * Post-build script: generates dist/sw.js from src/sw-template.js
 * with a precache manifest of all built assets.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { join, relative } from 'path'

const DIST = join(import.meta.dirname, '..', 'dist')
const TEMPLATE = join(import.meta.dirname, '..', 'src', 'sw-template.js')
const BASE = '/timeline-app/'

// Collect all files in dist/ recursively
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectFiles(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

const allFiles = collectFiles(DIST)

// Build precache URL list (critical assets only — lazy chunks cached on first use)
const CRITICAL_SIZE_THRESHOLD = 30 * 1024 // 30 kB — vendor chunks and core bundle

const precacheUrls = allFiles
  .map((f) => ({ url: BASE + relative(DIST, f), size: statSync(f).size, path: f }))
  .filter(({ url, size }) =>
    // Always exclude sw.js and sourcemaps
    !url.endsWith('/sw.js') &&
    !url.endsWith('.map') &&
    (
      // Always precache HTML, CSS, SVG, JSON (small, critical for layout)
      url.endsWith('.html') || url.endsWith('.css') || url.endsWith('.svg') || url.endsWith('.json') ||
      // Only precache large JS (vendor + core) — lazy chunks will cache on first use
      (url.endsWith('.js') && size >= CRITICAL_SIZE_THRESHOLD)
    )
  )
  .map(({ url }) => url)

// Ensure index.html is first (for offline navigation fallback)
precacheUrls.sort((a, b) => {
  if (a.endsWith('index.html')) return -1
  if (b.endsWith('index.html')) return 1
  return a.localeCompare(b)
})

// Generate a cache name from the hash of the manifest
const manifestHash = createHash('md5')
  .update(JSON.stringify(precacheUrls))
  .digest('hex')
  .slice(0, 8)
const cacheName = `timeline-${manifestHash}`

// Read template and inject values
let sw = readFileSync(TEMPLATE, 'utf-8')
sw = sw.replace('__CACHE_NAME__', cacheName)
sw = sw.replace('__PRECACHE_MANIFEST__', JSON.stringify(precacheUrls, null, 2))
sw = sw.replaceAll("'__BASE__'", `'${BASE}'`)

// Write final sw.js to dist
writeFileSync(join(DIST, 'sw.js'), sw)

console.log(`Generated sw.js with cache "${cacheName}" — ${precacheUrls.length} assets precached`)
