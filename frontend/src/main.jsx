import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// PWA service worker. autoUpdate means a new deploy's SW skips waiting, claims
// the page, and the app reloads onto the fresh build automatically. We also poll
// so a tab left open for hours still picks up new deploys instead of running a
// stale index.html whose hashed assets the new deploy has already deleted.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const checkForUpdate = () => registration.update().catch(() => {})
    setInterval(checkForUpdate, 60 * 60 * 1000) // hourly
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Render the last-fetched data instantly on reload, then revalidate in the
      // background (stale-while-revalidate). gcTime must outlive a session so the
      // cache is still around to be persisted/restored.
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'trackit-query-cache',
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: 'v1' }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>
)
