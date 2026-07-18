import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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