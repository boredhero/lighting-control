import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface UserItem { id: string; username: string; role_id: string | null; is_admin: boolean; is_guest: boolean; guest_expires_at: string | null }
interface RoleItem { id: string; name: string; is_guest: boolean }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserItem | null
}

export function EditUserDialog({ open, onOpenChange, user: editUser }: Props) {
  const [roleId, setRoleId] = useState('')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const queryClient = useQueryClient()
  const { data: roles = [] } = useQuery<RoleItem[]>({ queryKey: ['roles'], queryFn: () => api.get('/auth/roles') })
  const selectedRole = roles.find((r) => r.id === roleId)
  useEffect(() => {
    if (editUser) {
      setRoleId(editUser.role_id ?? '')
      setHasExpiry(!!editUser.guest_expires_at)
      setExpiresAt(editUser.guest_expires_at ? new Date(editUser.guest_expires_at).toISOString().slice(0, 16) : '')
    }
  }, [editUser])
  const updateMutation = useMutation({
    mutationFn: (data: { role_id: string; guest_expires_at: string | null }) => api.put(`/auth/users/${editUser?.id}`, data),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries({ queryKey: ['users'] }); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleSave = () => {
    updateMutation.mutate({ role_id: roleId, guest_expires_at: selectedRole?.is_guest && hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null })
  }
  if (!editUser) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {editUser.username}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedRole?.is_guest && (
            <>
              <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Time-limited access</Label></div>
              {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!roleId || updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
