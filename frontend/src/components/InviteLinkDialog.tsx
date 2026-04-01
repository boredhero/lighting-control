import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteLinkDialog({ open, onOpenChange }: Props) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const generateMutation = useMutation({
    mutationFn: () => api.post<{ code: string; url: string }>('/auth/invites'),
    onSuccess: (data) => { const d = data as { code: string; url: string }; setInviteUrl(d.url) },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }
  const resetAndClose = () => { setInviteUrl(''); setCopied(false); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md">
        <DialogHeader><DialogTitle>Generate Invite Link</DialogTitle></DialogHeader>
        {!inviteUrl ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a single-use invite link. Anyone with this link can create an admin account.</p>
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
            <p className="text-xs text-muted-foreground">This link can only be used once. Share it with the person you want to invite.</p>
            <Button variant="outline" onClick={resetAndClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
