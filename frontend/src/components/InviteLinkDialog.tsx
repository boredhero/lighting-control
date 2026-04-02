import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RoleItem { id: string; name: string }

export function InviteLinkDialog({ open, onOpenChange }: Props) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryValue, setExpiryValue] = useState('')
  const [roleId, setRoleId] = useState('')
  const queryClient = useQueryClient()
  const { data: roles = [] } = useQuery<RoleItem[]>({ queryKey: ['roles'], queryFn: () => api.get('/auth/roles') })
  const generateMutation = useMutation({
    mutationFn: () => api.post<{ code: string; url: string; expires_at: string | null }>('/auth/invites', { expires_at: hasExpiry && expiryValue ? new Date(expiryValue).toISOString() : null, role_id: roleId }),
    onSuccess: (data) => { const d = data as { code: string; url: string; expires_at: string | null }; setInviteUrl(d.url); setExpiresAt(d.expires_at); queryClient.invalidateQueries({ queryKey: ['invites'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }
  const resetAndClose = () => { setInviteUrl(''); setExpiresAt(null); setCopied(false); setHasExpiry(false); setExpiryValue(''); setRoleId(''); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Generate Invite Link</DialogTitle></DialogHeader>
        {!inviteUrl ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a single-use invite link. The recipient will create an account with the role you choose.</p>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={(v) => { if (v) setRoleId(v) }}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3"><Switch checked={hasExpiry} onCheckedChange={setHasExpiry} /><Label className="text-sm">Set expiration</Label></div>
            {hasExpiry && <div className="flex flex-col gap-2"><Label>Expires At</Label><Input type="datetime-local" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} /></div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button onClick={() => generateMutation.mutate()} disabled={!roleId || generateMutation.isPending}>{generateMutation.isPending ? 'Generating...' : 'Generate Link'}</Button>
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
