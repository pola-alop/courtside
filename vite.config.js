import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Courtside',
        short_name: 'Courtside',
        description: 'Companion personale per attrezzatura, partite e statistiche di tennis',
        theme_color: '#020D19',
        background_color: '#020D19',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Firestore fa già la propria cache/offline: il service worker qui
        // deve solo servire l'app shell da cache, non intercettare le
        // chiamate Firebase (auth/firestore googleapis.com).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      // devOptions.enabled resta false (default): il SW va testato con
      // `npm run build && npm run preview`, non in `npm run dev` — in dev
      // interferirebbe con l'HMR e la cache di Vite.
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Firebase è la dipendenza più pesante ed è comune a tutte le pagine:
        // isolarla in un chunk a sé la rende cacheabile a lungo (cambia di rado)
        // e alleggerisce i chunk delle singole pagine.
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            // Firestore è il modulo più pesante: chunk a sé, separato da auth/app
            if (id.includes('/@firebase/firestore') || id.includes('/firebase/firestore')) return 'firebase-firestore'
            if (id.includes('/@firebase/') || id.includes('/firebase/')) return 'firebase-core'
          }
        },
      },
    },
  },
})