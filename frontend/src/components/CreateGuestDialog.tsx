import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RoleItem { id: string; name: string; is_guest: boolean }

export function CreateGuestDialog({ open, onOpenChange }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const queryClient = useQueryClient()
  const { data: roles = [] } = useQuery<RoleItem[]>({ queryKey: ['roles'], queryFn: () => api.get('/auth/roles') })
  const selectedRole = roles.find((r) => r.id === roleId)
  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role_id: string; expires_at: string | null }) => api.post('/auth/users', data),
    onSuccess: () => { toast.success('User created'); queryClient.invalidateQueries({ queryKey: ['users'] }); resetAndClose() },
    onError: (err: Error) => toast.error(err.message),
  })
  const resetAndClose = () => { setUsername(''); setPassword(''); setRoleId(''); setHasExpiry(false); setExpiresAt(''); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ username, password, role_id: roleId, expires_at: selectedRole?.is_guest && hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null }) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required /></div>
          <div className="flex flex-col gap-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></div>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(v) => { if (v) setRoleId(v) }}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedRole?.is_guest && (
            <>
              <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Time-limited access</Label></div>
              {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required /></div>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button type="submit" disabled={!username.trim() || password.length < 8 || !roleId || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create User'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
