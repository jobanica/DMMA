import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA config: installable on any phone browser, no app store (spec §5).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DMMA Teacher Attendance',
        short_name: 'DMMA Attend',
        description: 'QR + face-verified faculty time in/out.',
        theme_color: '#0f766e',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // face-api.js model shards are large; cache them once fetched.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'face-models', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
})
