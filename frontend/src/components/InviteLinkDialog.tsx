import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Copy, Check } from 'lucide-react'
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

export function InviteLinkDialog({ open, onOpenChange }: Props) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryValue, setExpiryValue] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS })
  const queryClient = useQueryClient()
  const generateMutation = useMutation({
    mutationFn: () => api.post<{ code: string; url: string; expires_at: string | null }>('/auth/invites', { expires_at: hasExpiry && expiryValue ? new Date(expiryValue).toISOString() : null, role, permissions: role === 'admin' ? undefined : permissions }),
    onSuccess: (data) => { const d = data as { code: string; url: string; expires_at: string | null }; setInviteUrl(d.url); setExpiresAt(d.expires_at); queryClient.invalidateQueries({ queryKey: ['invites'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }
  const togglePerm = (key: string) => setPermissions({ ...permissions, [key]: !permissions[key] })
  const resetAndClose = () => { setInviteUrl(''); setExpiresAt(null); setCopied(false); setHasExpiry(false); setExpiryValue(''); setRole('user'); setPermissions({ ...DEFAULT_PERMS }); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Generate Invite Link</DialogTitle></DialogHeader>
        {!inviteUrl ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a single-use invite link. The recipient will create an account with the role and permissions you choose.</p>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                <Button variant={role === 'admin' ? 'default' : 'outline'} size="sm" onClick={() => setRole('admin')}>Admin</Button>
                <Button variant={role === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setRole('user')}>User</Button>
              </div>
            </div>
            {role === 'user' && (
              <div className="flex flex-col gap-2">
                <Label>Permissions</Label>
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm">{label}</span>
                    <Switch checked={permissions[key]} onCheckedChange={() => togglePerm(key)} />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Set expiration</Label></div>
            {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} /></div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>{generateMutation.isPending ? 'Generating...' : 'Generate Link'}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Label>Invite URL (single use)</Label>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>{copied ? <Check size={16} /> : <Copy size={16} />}</Button>
            </div>
            {expiresAt && <p className="text-xs text-muted-foreground">Expires: {new Date(expiresAt).toLocaleString()}</p>}
            {!expiresAt && <p className="text-xs text-muted-foreground">No expiration — valid until used.</p>}
            <Button variant="outline" onClick={resetAndClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
