import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [partialToken, setPartialToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)
  const navigate = useNavigate()
  const { login, loginTotp, isAuthenticated } = useAuthStore()
  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return }
    api.get<{ setup_complete: boolean }>('/auth/setup-status').then((res) => {
      if (!res.setup_complete) navigate('/setup', { replace: true })
      else setCheckingSetup(false)
    }).catch(() => setCheckingSetup(false))
  }, [navigate, isAuthenticated])
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await login(username, password)
      if (result.requires_totp && result.partial_token) {
        setPartialToken(result.partial_token)
        toast.info('Enter your TOTP code')
      } else {
        navigate('/')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }
  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partialToken) return
    setLoading(true)
    try {
      await loginTotp(totpCode, partialToken)
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid TOTP code')
    } finally {
      setLoading(false)
    }
  }
  if (checkingSetup) return <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)]"><p className="text-muted-foreground">Loading...</p></div>
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)] p-4">
      <Card className="w-full max-w-sm bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle className="text-center text-[var(--color-amber)]">Lighting Control</CardTitle></CardHeader>
        <CardContent>
          {!partialToken ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Signing in...' : 'Sign In'}</Button>
            </form>
          ) : (
            <form onSubmit={handleTotp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label htmlFor="totp">TOTP Code</Label><Input id="totp" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} maxLength={6} autoComplete="one-time-code" required /></div>
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Verifying...' : 'Verify'}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
