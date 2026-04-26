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
import { BackupSection } from '@/components/BackupSection'

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
    <div className="space-y-6 3xl:space-y-8 tv:space-y-12 max-w-2xl lg:max-w-7xl 3xl:max-w-[100rem] tv:max-w-[120rem] mx-auto">
      <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight">Settings</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 3xl:gap-8 items-start">
      <Card className="bg-[var(--surface-1)] border-border 3xl:py-6 tv:py-10 3xl:gap-6 tv:gap-10">
        <CardHeader className="3xl:px-6 tv:px-10"><CardTitle className="flex items-center gap-2 3xl:gap-3 3xl:text-xl tv:text-3xl"><Shield className="size-[18px] 3xl:size-6 tv:size-9" />Account</CardTitle></CardHeader>
        <CardContent className="space-y-4 3xl:space-y-6 tv:space-y-10 3xl:px-6 tv:px-10">
          <div className="grid grid-cols-2 gap-2 3xl:gap-4 tv:gap-6 text-sm 3xl:text-base tv:text-2xl">
            <span className="text-muted-foreground">Username</span><span>{user?.username}</span>
            <span className="text-muted-foreground">Role</span><span>{user?.is_admin ? 'Admin' : user?.is_guest ? 'Guest' : 'User'}</span>
            <span className="text-muted-foreground">TOTP</span><Badge variant={user?.totp_enabled ? 'default' : 'secondary'} className="w-fit 3xl:text-sm tv:text-lg tv:px-3 tv:py-1">{user?.totp_enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
          <Separator />
          <div className="flex gap-2 3xl:gap-3 flex-wrap">
            {user?.totp_enabled ? (
              <Button variant="outline" size="sm" className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" onClick={() => disableTotpMutation.mutate()}>Disable TOTP</Button>
            ) : (
              <Button variant="outline" size="sm" className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" onClick={() => setTotpOpen(true)}><Key className="size-[14px] 3xl:size-5 tv:size-6 mr-1" />Enable TOTP</Button>
            )}
          </div>
        </CardContent>
      </Card>
      {user?.is_admin && (
        <>
          <Card className="bg-[var(--surface-1)] border-border 3xl:py-6 tv:py-10 3xl:gap-6 tv:gap-10">
            <CardHeader className="3xl:px-6 tv:px-10"><CardTitle className="flex items-center gap-2 3xl:gap-3 3xl:text-xl tv:text-3xl"><ShieldCheck className="size-[18px] 3xl:size-6 tv:size-9" />Roles</CardTitle></CardHeader>
            <CardContent className="space-y-4 3xl:space-y-6 tv:space-y-8 3xl:px-6 tv:px-10">
              <Button variant="outline" size="sm" className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" onClick={() => setCreateRoleOpen(true)}><Plus className="size-[14px] 3xl:size-5 tv:size-6 mr-1" />Create Role</Button>
              <div className="space-y-2 3xl:space-y-3 tv:space-y-5">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 3xl:py-3 3xl:px-4 tv:py-5 tv:px-7 bg-[var(--surface-2)] rounded-lg">
                    <div className="flex items-center gap-2 3xl:gap-3 tv:gap-5">
                      <span className="font-medium text-sm 3xl:text-base tv:text-2xl">{r.name}</span>
                      {r.is_system && <Badge variant="outline" className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">System</Badge>}
                      {r.is_admin && <Badge variant="default" className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">Admin</Badge>}
                      {r.is_guest && <Badge variant="secondary" className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">Guest</Badge>}
                    </div>
                    {!r.is_system && <Button variant="ghost" size="icon" className="tv:size-12" onClick={() => deleteRoleMutation.mutate(r.id)}><Trash2 className="size-[14px] tv:size-6 text-destructive" /></Button>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--surface-1)] border-border 3xl:py-6 tv:py-10 3xl:gap-6 tv:gap-10">
            <CardHeader className="3xl:px-6 tv:px-10"><CardTitle className="flex items-center gap-2 3xl:gap-3 3xl:text-xl tv:text-3xl"><Users className="size-[18px] 3xl:size-6 tv:size-9" />User Management</CardTitle></CardHeader>
            <CardContent className="space-y-4 3xl:space-y-6 tv:space-y-8 3xl:px-6 tv:px-10">
              <div className="flex gap-2 3xl:gap-3 flex-wrap">
                <Button variant="outline" size="sm" className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" onClick={() => setGuestOpen(true)}><UserPlus className="size-[14px] 3xl:size-5 tv:size-6 mr-1" />Create User</Button>
                <Button variant="outline" size="sm" className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" onClick={() => setInviteOpen(true)}><Link2 className="size-[14px] 3xl:size-5 tv:size-6 mr-1" />Generate Invite Link</Button>
              </div>
              {invites.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2 3xl:space-y-3 tv:space-y-5">
                    <h3 className="text-sm 3xl:text-base tv:text-xl font-medium text-muted-foreground">Active Invite Links</h3>
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2 px-3 3xl:py-3 3xl:px-4 tv:py-5 tv:px-7 bg-[var(--surface-2)] rounded-lg">
                        <div className="flex flex-col gap-0.5 3xl:gap-1">
                          <div className="flex items-center gap-2 3xl:gap-3"><span className="font-mono text-xs 3xl:text-sm tv:text-lg">{inv.code.slice(0, 16)}...</span><Badge variant="outline" className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">{getRoleName(inv.role_id)}</Badge></div>
                          <span className="text-xs 3xl:text-sm tv:text-lg text-muted-foreground">{inv.expires_at ? `Expires: ${new Date(inv.expires_at).toLocaleString()}` : 'No expiration'}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="tv:size-12" onClick={() => revokeInviteMutation.mutate(inv.id)}><X className="size-[14px] tv:size-6 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Separator />
              <div className="space-y-2 3xl:space-y-3 tv:space-y-5">
                <h3 className="text-sm 3xl:text-base tv:text-xl font-medium text-muted-foreground">All Users</h3>
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 3xl:py-3 3xl:px-4 tv:py-5 tv:px-7 bg-[var(--surface-2)] rounded-lg">
                    <div className="flex items-center gap-3 3xl:gap-4 tv:gap-6">
                      <span className="font-medium text-sm 3xl:text-base tv:text-2xl">{u.username}</span>
                      <Badge variant={u.is_admin ? 'default' : u.is_guest ? 'secondary' : 'outline'} className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">{getRoleName(u.role_id)}</Badge>
                      {u.totp_enabled && <Badge variant="outline" className="3xl:text-sm tv:text-lg tv:px-3 tv:py-1">TOTP</Badge>}
                      {u.is_guest && u.guest_expires_at && <span className="text-xs 3xl:text-sm tv:text-lg text-muted-foreground">Expires: {new Date(u.guest_expires_at).toLocaleDateString()}</span>}
                    </div>
                    {u.id !== user?.id && (
                      <div className="flex items-center gap-1 3xl:gap-2">
                        <Button variant="ghost" size="icon" className="tv:size-12" onClick={() => setEditUser(u)}><Pencil className="size-[14px] tv:size-6" /></Button>
                        <Button variant="ghost" size="icon" className="tv:size-12" onClick={() => { if (confirm(`Delete user "${u.username}"?`)) deleteMutation.mutate(u.id) }}><Trash2 className="size-[14px] tv:size-6 text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {(user?.is_admin || user?.permissions?.can_manage_devices) && <BackupSection />}
      </div>
      <div className="flex justify-center"><Button variant="destructive" onClick={handleLogout} className="w-full lg:w-auto lg:px-16 3xl:h-12 3xl:text-lg tv:h-16 tv:text-2xl tv:px-24">Sign Out</Button></div>
      <TOTPSetupDialog open={totpOpen} onOpenChange={setTotpOpen} />
      <CreateGuestDialog open={guestOpen} onOpenChange={setGuestOpen} />
      <InviteLinkDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditUserDialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }} user={editUser} />
      <CreateRoleDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen} />
    </div>
  )
}
