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

export function CreateRoleDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS })
  const queryClient = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (data: { name: string; is_admin: boolean; is_guest: boolean; permissions: Record<string, boolean> }) => api.post('/auth/roles', data),
    onSuccess: () => { toast.success('Role created'); queryClient.invalidateQueries({ queryKey: ['roles'] }); resetAndClose() },
    onError: (err: Error) => toast.error(err.message),
  })
  const togglePerm = (key: string) => setPermissions({ ...permissions, [key]: !permissions[key] })
  const resetAndClose = () => { setName(''); setIsAdmin(false); setIsGuest(false); setPermissions({ ...DEFAULT_PERMS }); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Role</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name, is_admin: isAdmin, is_guest: isGuest, permissions }) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Moderator" required autoFocus /></div>
          <div className="flex items-center gap-3"><Switch checked={isAdmin} onCheckedChange={(v) => { setIsAdmin(v); if (v) setIsGuest(false) }} /><Label className="text-sm">Full admin access (bypasses all permissions)</Label></div>
          <div className="flex items-center gap-3"><Switch checked={isGuest} onCheckedChange={(v) => { setIsGuest(v); if (v) setIsAdmin(false) }} /><Label className="text-sm">Guest role (supports expiration)</Label></div>
          {!isAdmin && (
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Role'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
