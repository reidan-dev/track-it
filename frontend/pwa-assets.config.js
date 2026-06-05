import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Pad the maskable icon so the mark stays inside the safe zone.
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#2563eb' } },
    apple: { sizes: [180], padding: 0.3, resizeOptions: { background: '#2563eb' } },
  },
  images: ['public/logo.svg'],
})
