import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { PasskeyButton } from '@/components/PasskeyButton'
import { browserSupportsWebAuthn, loginWithPasskey } from '@/lib/passkey'

type Stage = 'initial' | 'password' | 'second_factor'

export function LoginPage() {
  const [stage, setStage] = useState<Stage>('initial')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [partialToken, setPartialToken] = useState<string | null>(null)
  const [availableFactors, setAvailableFactors] = useState<string[]>([])
  const [secondFactorChoice, setSecondFactorChoice] = useState<'passkey' | 'totp' | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)
  const navigate = useNavigate()
  const { login, loginTotp, finalizePasskeyLogin, isAuthenticated } = useAuthStore()
  const passkeySupported = browserSupportsWebAuthn()

  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return }
    api.get<{ setup_complete: boolean }>('/auth/setup-status').then((res) => {
      if (!res.setup_complete) navigate('/setup', { replace: true })
      else setCheckingSetup(false)
    }).catch(() => setCheckingSetup(false))
  }, [navigate, isAuthenticated])

  const handlePasskeyLogin = async () => {
    if (!username.trim()) {
      toast.error('Enter your username first')
      return
    }
    const result = await loginWithPasskey({ username: username.trim() })
    await finalizePasskeyLogin(result.access_token, result.refresh_token)
    navigate('/')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await login(username, password)
      if (result.available_second_factors.length === 0) {
        navigate('/')
        return
      }
      setPartialToken(result.partial_token ?? null)
      setAvailableFactors(result.available_second_factors)
      setSecondFactorChoice(result.available_second_factors.includes('passkey') ? 'passkey' : 'totp')
      setStage('second_factor')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTotpSubmit = async (e: React.FormEvent) => {
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

  const handleSecondFactorPasskey = async () => {
    if (!partialToken) return
    const result = await loginWithPasskey({ username: username.trim() || undefined, partialToken })
    await finalizePasskeyLogin(result.access_token, result.refresh_token)
    navigate('/')
  }

  if (checkingSetup) return <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)]"><p className="text-muted-foreground">Loading...</p></div>

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)] p-4">
      <Card className="w-full max-w-sm bg-[var(--surface-1)] border-border" data-testid="login-card">
        <CardHeader><CardTitle className="text-center text-[var(--color-amber)]">Lighting Control</CardTitle></CardHeader>
        <CardContent>
          {stage === 'initial' && (
            <div className="flex flex-col gap-4" data-testid="login-stage-initial">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Username" data-testid="username-input" />
              </div>
              {passkeySupported ? (
                <PasskeyButton label="Sign in with a passkey" onClick={handlePasskeyLogin} className="w-full" testId="passkey-login-button" />
              ) : (
                <p className="text-xs text-muted-foreground text-center">Passkeys aren't supported in this browser.</p>
              )}
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline self-center" onClick={() => setStage('password')} data-testid="use-password-link">or use password instead</button>
            </div>
          )}
          {stage === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4" data-testid="login-stage-password">
              <div className="flex flex-col gap-2"><Label htmlFor="username-pw">Username</Label><Input id="username-pw" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
              <Button type="submit" disabled={loading} className="w-full" data-testid="password-submit">{loading ? 'Signing in...' : 'Sign In'}</Button>
              {passkeySupported && <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline self-center" onClick={() => setStage('initial')}>back to passkey sign-in</button>}
            </form>
          )}
          {stage === 'second_factor' && (
            <div className="flex flex-col gap-4" data-testid="login-stage-second-factor">
              <p className="text-sm text-center text-muted-foreground">One more step</p>
              {secondFactorChoice === 'passkey' && (
                <PasskeyButton label="Tap your security key" onClick={handleSecondFactorPasskey} className="w-full" testId="second-factor-passkey-button" />
              )}
              {secondFactorChoice === 'totp' && (
                <form onSubmit={handleTotpSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2"><Label htmlFor="totp">Authenticator Code</Label><Input id="totp" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} maxLength={6} autoComplete="one-time-code" required data-testid="totp-input" /></div>
                  <Button type="submit" disabled={loading} className="w-full" data-testid="totp-submit">{loading ? 'Verifying...' : 'Verify'}</Button>
                </form>
              )}
              {availableFactors.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline self-center"
                  onClick={() => setSecondFactorChoice(secondFactorChoice === 'passkey' ? 'totp' : 'passkey')}
                  data-testid="swap-second-factor"
                >
                  {secondFactorChoice === 'passkey' ? 'use authenticator code instead' : 'use a passkey instead'}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
