import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useNavigate } from 'react-router-dom'

export function SettingsPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = async () => { await logout(); navigate('/login') }
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold">Settings</h2>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Username</span><span>{user?.username}</span>
            <span className="text-muted-foreground">Role</span><span>{user?.is_admin ? 'Admin' : user?.is_guest ? 'Guest' : 'User'}</span>
            <span className="text-muted-foreground">TOTP</span><span>{user?.totp_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Change Password</Button>
            <Button variant="outline" size="sm">{user?.totp_enabled ? 'Disable' : 'Enable'} TOTP</Button>
          </div>
        </CardContent>
      </Card>
      {user?.is_admin && (
        <Card className="bg-[var(--surface-1)] border-border">
          <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm">Create Guest Account</Button>
            <Button variant="outline" size="sm">Generate Invite Link</Button>
          </CardContent>
        </Card>
      )}
      <Button variant="destructive" onClick={handleLogout} className="w-full">Sign Out</Button>
    </div>
  )
}
