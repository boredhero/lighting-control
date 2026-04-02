import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useNavigate } from 'react-router-dom'
import { Trash2, UserPlus, Link2, Shield, Key, Users, X, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { TOTPSetupDialog } from '@/components/TOTPSetupDialog'
import { CreateGuestDialog } from '@/components/CreateGuestDialog'
import { InviteLinkDialog } from '@/components/InviteLinkDialog'
import { EditUserDialog } from '@/components/EditUserDialog'
import { CreateRoleDialog } from '@/components/CreateRoleDialog'

interface UserItem { id: string; username: string; role_id: string | null; is_admin: boolean; is_guest: boolean; guest_expires_at: string | null; totp_enabled: boolean; permissions: Record<string, boolean>; created_at: string }
interface InviteItem { id: string; code: string; role_id: string; created_at: string; expires_at: string | null }
interface RoleItem { id: string; name: string; is_system: boolean; is_admin: boolean; is_guest: boolean; permissions: Record<string, boolean> }

export function SettingsPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [totpOpen, setTotpOpen] = useState(false)
  const [guestOpen, setGuestOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const { data: users = [] } = useQuery<UserItem[]>({ queryKey: ['users'], queryFn: () => api.get('/auth/users'), enabled: user?.is_admin === true })
  const { data: invites = [] } = useQuery<InviteItem[]>({ queryKey: ['invites'], queryFn: () => api.get('/auth/invites'), enabled: user?.is_admin === true })
  const { data: roles = [] } = useQuery<RoleItem[]>({ queryKey: ['roles'], queryFn: () => api.get('/auth/roles'), enabled: user?.is_admin === true })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/auth/users/${id}`), onSuccess: () => { toast.success('User deleted'); queryClient.invalidateQueries({ queryKey: ['users'] }) }, onError: (err: Error) => toast.error(err.message) })
  const revokeInviteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/auth/invites/${id}`), onSuccess: () => { toast.success('Invite revoked'); queryClient.invalidateQueries({ queryKey: ['invites'] }) }, onError: (err: Error) => toast.error(err.message) })
  const deleteRoleMutation = useMutation({ mutationFn: (id: string) => api.delete(`/auth/roles/${id}`), onSuccess: () => { toast.success('Role deleted'); queryClient.invalidateQueries({ queryKey: ['roles'] }) }, onError: (err: Error) => toast.error(err.message) })
  const disableTotpMutation = useMutation({ mutationFn: () => api.delete('/auth/me/totp'), onSuccess: () => { toast.success('TOTP disabled'); queryClient.invalidateQueries({ queryKey: ['user'] }); window.location.reload() }, onError: (err: Error) => toast.error(err.message) })
  const handleLogout = async () => { await logout(); navigate('/login') }
  const getRoleName = (roleId: string | null) => { const r = roles.find((role) => role.id === roleId); return r?.name ?? 'Unknown' }
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold">Settings</h2>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} />Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Username</span><span>{user?.username}</span>
            <span className="text-muted-foreground">Role</span><span>{user?.is_admin ? 'Admin' : user?.is_guest ? 'Guest' : 'User'}</span>
            <span className="text-muted-foreground">TOTP</span><Badge variant={user?.totp_enabled ? 'default' : 'secondary'}>{user?.totp_enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
          <Separator />
          <div className="flex gap-2 flex-wrap">
            {user?.totp_enabled ? (
              <Button variant="outline" size="sm" onClick={() => disableTotpMutation.mutate()}>Disable TOTP</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setTotpOpen(true)}><Key size={14} className="mr-1" />Enable TOTP</Button>
            )}
          </div>
        </CardContent>
      </Card>
      {user?.is_admin && (
        <>
          <Card className="bg-[var(--surface-1)] border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={18} />Roles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => setCreateRoleOpen(true)}><Plus size={14} className="mr-1" />Create Role</Button>
              <div className="space-y-2">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 bg-[var(--surface-2)] rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.name}</span>
                      {r.is_system && <Badge variant="outline">System</Badge>}
                      {r.is_admin && <Badge variant="default">Admin</Badge>}
                      {r.is_guest && <Badge variant="secondary">Guest</Badge>}
                    </div>
                    {!r.is_system && <Button variant="ghost" size="icon" onClick={() => deleteRoleMutation.mutate(r.id)}><Trash2 size={14} className="text-destructive" /></Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--surface-1)] border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18} />User Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setGuestOpen(true)}><UserPlus size={14} className="mr-1" />Create User</Button>
                <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}><Link2 size={14} className="mr-1" />Generate Invite Link</Button>
              </div>
              {invites.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Active Invite Links</h3>
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 px-3 bg-[var(--surface-2)] rounded">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2"><span className="font-mono text-xs">{inv.code.slice(0, 16)}...</span><Badge variant="outline">{getRoleName(inv.role_id)}</Badge></div>
                          <span className="text-xs text-muted-foreground">{inv.expires_at ? `Expires: ${new Date(inv.expires_at).toLocaleString()}` : 'No expiration'}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => revokeInviteMutation.mutate(inv.id)}><X size={14} className="text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">All Users</h3>
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-[var(--surface-2)] rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{u.username}</span>
                      <Badge variant={u.is_admin ? 'default' : u.is_guest ? 'secondary' : 'outline'}>{getRoleName(u.role_id)}</Badge>
                      {u.totp_enabled && <Badge variant="outline">TOTP</Badge>}
                      {u.is_guest && u.guest_expires_at && <span className="text-xs text-muted-foreground">Expires: {new Date(u.guest_expires_at).toLocaleDateString()}</span>}
                    </div>
                    {u.id !== user?.id && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditUser(u)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete user "${u.username}"?`)) deleteMutation.mutate(u.id) }}><Trash2 size={14} className="text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <Button variant="destructive" onClick={handleLogout} className="w-full">Sign Out</Button>
      <TOTPSetupDialog open={totpOpen} onOpenChange={setTotpOpen} />
      <CreateGuestDialog open={guestOpen} onOpenChange={setGuestOpen} />
      <InviteLinkDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditUserDialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }} user={editUser} />
      <CreateRoleDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen} />
    </div>
  )
}
