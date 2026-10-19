import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import type { Session, User, UserRole } from '@/domain/types'
import { can, type Permission } from '@/domain/permissions'
import { getApi } from '@/api/provider'
import { ApiError } from '@/api/errors'

const SESSION_KEY = 'fms.session'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: UserRole | undefined
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cached = localStorage.getItem(SESSION_KEY)
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Session
            if (!cancelled) setSession(parsed)
          } catch {
            localStorage.removeItem(SESSION_KEY)
          }
        }
        const fresh = await getApi().getSession()
        if (!cancelled) {
          if (fresh) {
            setSession(fresh)
            localStorage.setItem(SESSION_KEY, JSON.stringify(fresh))
          } else if (getApi().mode === 'http') {
            setSession(null)
            localStorage.removeItem(SESSION_KEY)
          }
        }
      } catch {
        /* offline / server unreachable — keep cached session */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const s = await getApi().login({ email, password })
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }, [])

  const logout = useCallback(async () => {
    try {
      await getApi().logout()
    } catch {
      /* ignore — clear local session regardless */
    }
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role: session?.user.role,
      loading,
      login,
      logout,
      can: (p) => can(session?.user.role, p),
    }),
    [session, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/**
 * Query client defaults tuned for a small-business finance app:
 * - no refetch storms (data is edited explicitly)
 * - 401 handled centrally by adapters
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'forbidden' || error.kind === 'validation' || error.kind === 'not_found')) {
            return false
          }
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
