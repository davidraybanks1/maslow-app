import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // Stamped at build time; surfaces in Settings as "built <date>"
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      // manifest.json already lives in public/ — don't generate a second one
      manifest: false,
      workbox: {
        // After skipWaiting, immediately claim all open clients
        clientsClaim: true,
        // Precache only content-addressed (hashed) assets.
        // index.html is intentionally excluded — handled by NetworkFirst at runtime.
        globPatterns: ['assets/**/*.{js,css}', '*.{ico,png,svg}'],
        // No SPA navigateFallback — we use NetworkFirst for navigation instead
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigation (page loads): always try the network first so index.html
            // is never stale. Falls back to a cached copy only when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'maslow-navigation',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts CSS: stale-while-revalidate (changes rarely)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // Google Fonts files: cache-first, year expiry (immutable once fetched)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
