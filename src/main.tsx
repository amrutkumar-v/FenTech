import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './app/router'
import { AuthProvider, makeQueryClient } from '@/features/auth/AuthProvider'
import { SyncProvider } from '@/offline/sync'
import { ToastProvider } from '@/ui/Toast'
import { applyStoredTheme } from '@/features/settings/theme'

applyStoredTheme()

const queryClient = makeQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            <RouterProvider router={router} />
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
