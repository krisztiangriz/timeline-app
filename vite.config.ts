/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  base: '/timeline-app/',
  plugins: [
    react(),
    {
      name: 'strip-csp-dev',
      transformIndexHtml(html, ctx) {
        // Remove the CSP meta tag in dev so Vite HMR WebSocket isn't blocked
        if (ctx.server) {
          return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
        }
        return html
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts'
          }
        },
      },
    },
  },
})
