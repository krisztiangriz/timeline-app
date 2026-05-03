import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'

// Inject favicon and manifest with correct base path
const base = import.meta.env.BASE_URL
const favicon = document.createElement('link')
favicon.rel = 'icon'
favicon.type = 'image/svg+xml'
favicon.href = `${base}favicon.svg`
document.head.appendChild(favicon)

const manifest = document.createElement('link')
manifest.rel = 'manifest'
manifest.href = `${base}manifest.json`
document.head.appendChild(manifest)

// Register service worker for PWA (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
