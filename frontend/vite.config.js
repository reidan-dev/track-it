import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register + drive updates ourselves in main.jsx so long-open tabs poll
      // for new deploys and reload onto the fresh build (no stale-asset errors).
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'track.it',
        short_name: 'track.it',
        description: 'Track expenses, bills, installments, loans and income.',
        theme_color: '#2563eb',
        background_color: '#020817',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + static assets.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // A new SW takes over immediately instead of waiting for every tab to
        // close — pairs with the controllerchange reload in main.jsx.
        skipWaiting: true,
        clientsClaim: true,
        // SPA fallback so deep links work offline; exclude API + auth paths.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        // Never cache authed financial data — it lives on a separate origin and
        // must always come fresh. Be explicit anyway.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin !== self.location.origin,
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
