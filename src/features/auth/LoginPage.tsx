import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '@/ui/Button'
import { Input, Field } from '@/ui/Input'
import { Card, CardBody } from '@/ui/Card'
import { isMockMode } from '@/api/provider'
import { DEMO_PASSWORD, DEMO_USERS } from '@/api/mock/db'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const fe: Record<string, string> = {}
    if (!email.trim()) fe.email = 'Email is required'
    if (!password) fe.password = 'Password is required'
    if (Object.keys(fe).length) {
      setFieldErrors(fe)
      return
    }
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err && typeof err === 'object' && 'fieldErrors' in err && err.fieldErrors) {
        setFieldErrors(err.fieldErrors as Record<string, string>)
      }
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-700 text-white">
            <ShieldCheck className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Finance Management System</h1>
          <p className="mt-1 text-sm text-text-muted">Private access for authorized users only</p>
        </div>

        {isMockMode() && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-semibold">Development mock mode</p>
            <p className="mt-0.5">
              No backend is connected. Demo fixtures load on first use and are clearly labelled.
            </p>
            <ul className="mt-2 space-y-0.5 font-mono">
              {DEMO_USERS.map((u) => (
                <li key={u.id}>
                  {u.email} / {DEMO_PASSWORD}{' '}
                  <span className="font-sans text-amber-700 dark:text-amber-400">({u.role})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card>
          <CardBody>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
                  {error}
                </div>
              )}
              <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  invalid={!!fieldErrors.email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password" htmlFor="password" required error={fieldErrors.password}>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    invalid={!!fieldErrors.password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary"
                  >
                    {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              </Field>
              <Button type="submit" className="w-full" size="lg" loading={busy}>
                Sign in
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-text-muted">
          Only two authorized users can access this system. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  )
}
