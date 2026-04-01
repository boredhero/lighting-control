import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function SetupPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/auth/setup', { username, password })
      toast.success('Admin account created! Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--surface-0)] p-4">
      <Card className="w-full max-w-sm bg-[var(--surface-1)] border-border">
        <CardHeader>
          <CardTitle className="text-center text-[var(--color-amber)]">Initial Setup</CardTitle>
          <CardDescription className="text-center">Create your admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required /></div>
            <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create Admin Account'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
