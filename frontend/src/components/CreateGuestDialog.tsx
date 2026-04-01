import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERMISSION_LABELS: Record<string, string> = {
  can_control_devices: 'Control Devices',
  can_execute_quick_actions: 'Execute Quick Actions',
  can_manage_quick_actions: 'Manage Quick Actions',
  can_view_schedules: 'View Schedules',
  can_manage_schedules: 'Manage Schedules',
  can_manage_devices: 'Manage Devices',
  can_manage_users: 'Manage Users',
}

const DEFAULT_PERMS: Record<string, boolean> = {
  can_control_devices: true,
  can_execute_quick_actions: true,
  can_manage_quick_actions: false,
  can_view_schedules: true,
  can_manage_schedules: false,
  can_manage_devices: false,
  can_manage_users: false,
}

export function CreateGuestDialog({ open, onOpenChange }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS })
  const queryClient = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; expires_at: string | null; permissions: Record<string, boolean> }) => api.post('/auth/guests', data),
    onSuccess: () => { toast.success('Guest account created'); queryClient.invalidateQueries({ queryKey: ['users'] }); resetAndClose() },
    onError: (err: Error) => toast.error(err.message),
  })
  const resetAndClose = () => { setUsername(''); setPassword(''); setHasExpiry(false); setExpiresAt(''); setPermissions({ ...DEFAULT_PERMS }); onOpenChange(false) }
  const togglePerm = (key: string) => setPermissions({ ...permissions, [key]: !permissions[key] })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Guest Account</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ username, password, expires_at: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null, permissions }) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required /></div>
          <div className="flex flex-col gap-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div>
          <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Time-limited access</Label></div>
          {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required /></div>}
          <div className="flex flex-col gap-2">
            <Label>Permissions</Label>
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm">{label}</span>
                <Switch checked={permissions[key]} onCheckedChange={() => togglePerm(key)} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button type="submit" disabled={!username.trim() || password.length < 8 || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Guest'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
