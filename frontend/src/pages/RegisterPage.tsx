import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function RegisterPage() {
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('code')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    if (!inviteCode) { toast.error('Missing invite code'); navigate('/login', { replace: true }) }
  }, [inviteCode, navigate])
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/auth/register', { username, password, invite_code: inviteCode })
      toast.success('Account created! Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }
  if (!inviteCode) return null
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)] p-4">
      <Card className="w-full max-w-sm bg-[var(--surface-1)] border-border">
        <CardHeader>
          <CardTitle className="text-center text-[var(--color-amber)]">Create Account</CardTitle>
          <CardDescription className="text-center">You've been invited to join Lighting Control</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} autoComplete="username" required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></div>
            <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create Account'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
