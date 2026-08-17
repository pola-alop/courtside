import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera le icone PWA (favicon, apple-touch-icon, maskable) a partire dal logo
// esistente (public/favicon.svg). Il background è quello dell'app (--color-bg)
// così le icone maskable (ritagliate dal sistema in cerchio/squircle) non
// mostrano bordi trasparenti attorno al marchio.
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#020D19' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#020D19' },
    },
  },
  images: ['public/favicon.svg'],
})
