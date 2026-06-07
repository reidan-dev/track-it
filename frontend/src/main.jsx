import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App'
import './index.css'

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
