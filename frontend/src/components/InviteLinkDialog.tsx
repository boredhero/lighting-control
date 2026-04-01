import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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

export function InviteLinkDialog({ open, onOpenChange }: Props) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasExpiry, setHasExpiry] = useState(false)
  const [expiryValue, setExpiryValue] = useState('')
  const generateMutation = useMutation({
    mutationFn: () => api.post<{ code: string; url: string; expires_at: string | null }>('/auth/invites', { expires_at: hasExpiry && expiryValue ? new Date(expiryValue).toISOString() : null }),
    onSuccess: (data) => { const d = data as { code: string; url: string; expires_at: string | null }; setInviteUrl(d.url); setExpiresAt(d.expires_at) },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }
  const resetAndClose = () => { setInviteUrl(''); setExpiresAt(null); setCopied(false); setHasExpiry(false); setExpiryValue(''); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md">
        <DialogHeader><DialogTitle>Generate Invite Link</DialogTitle></DialogHeader>
        {!inviteUrl ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a single-use invite link. Anyone with this link can create an admin account.</p>
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
