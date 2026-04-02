import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface UserItem { id: string; username: string; is_admin: boolean; is_guest: boolean; guest_expires_at: string | null; permissions: Record<string, boolean> }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserItem | null
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

function deriveRole(u: UserItem): 'admin' | 'user' | 'guest' {
  if (u.is_admin) return 'admin'
  if (u.is_guest) return 'guest'
  return 'user'
}

export function EditUserDialog({ open, onOpenChange, user: editUser }: Props) {
  const [role, setRole] = useState<'admin' | 'user' | 'guest'>('user')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const queryClient = useQueryClient()
  useEffect(() => {
    if (editUser) {
      setRole(deriveRole(editUser))
      setPermissions({ ...editUser.permissions })
      setHasExpiry(!!editUser.guest_expires_at)
      setExpiresAt(editUser.guest_expires_at ? new Date(editUser.guest_expires_at).toISOString().slice(0, 16) : '')
    }
  }, [editUser])
  const updateMutation = useMutation({
    mutationFn: (data: { role: string; permissions: Record<string, boolean>; guest_expires_at: string | null }) => api.put(`/auth/users/${editUser?.id}`, data),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries({ queryKey: ['users'] }); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  const togglePerm = (key: string) => setPermissions({ ...permissions, [key]: !permissions[key] })
  const handleSave = () => {
    updateMutation.mutate({ role, permissions, guest_expires_at: role === 'guest' && hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null })
  }
  if (!editUser) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {editUser.username}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <div className="flex gap-2">
              <Button variant={role === 'admin' ? 'default' : 'outline'} size="sm" onClick={() => setRole('admin')}>Admin</Button>
              <Button variant={role === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setRole('user')}>User</Button>
              <Button variant={role === 'guest' ? 'default' : 'outline'} size="sm" onClick={() => setRole('guest')}>Guest</Button>
            </div>
          </div>
          {role !== 'admin' && (
            <div className="flex flex-col gap-2">
              <Label>Permissions</Label>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{label}</span>
                  <Switch checked={permissions[key] ?? false} onCheckedChange={() => togglePerm(key)} />
                </div>
              ))}
            </div>
          )}
          {role === 'guest' && (
            <>
              <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Time-limited access</Label></div>
              {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
