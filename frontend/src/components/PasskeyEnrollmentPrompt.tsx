import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { enrollPasskey, browserSupportsWebAuthn, isUserCancellation } from '@/lib/passkey'
import { toast } from 'sonner'
import { Fingerprint } from 'lucide-react'

const DISMISS_KEY = 'passkey_prompt_dismissed_v1'

export function isPasskeyPromptDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === '1'
}

export function dismissPasskeyPromptForever(): void {
  localStorage.setItem(DISMISS_KEY, '1')
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnrolled?: () => void
}

export function PasskeyEnrollmentPrompt({ open, onOpenChange, onEnrolled }: Props) {
  const [name, setName] = useState('My device')
  const [submitting, setSubmitting] = useState(false)
  const supported = browserSupportsWebAuthn()
  const handleSetup = async () => {
    if (!supported) return
    setSubmitting(true)
    try {
      await enrollPasskey(name.trim() || 'Passkey')
      toast.success('Passkey added')
      onOpenChange(false)
      onEnrolled?.()
    } catch (err) {
      if (!isUserCancellation(err)) {
        toast.error(err instanceof Error ? err.message : 'Could not register passkey')
      }
    } finally {
      setSubmitting(false)
    }
  }
  const handleDontAsk = () => {
    dismissPasskeyPromptForever()
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Fingerprint className="size-5" />Set up a passkey?</DialogTitle>
          <DialogDescription>Faster than typing a password. Use your fingerprint, face, or a security key.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="passkey-name">Name this passkey</Label>
          <Input id="passkey-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="e.g. My Phone" data-testid="passkey-name-input" />
          {!supported && <p className="text-xs text-muted-foreground">Passkeys aren't supported in this browser.</p>}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleDontAsk} data-testid="passkey-dontask">Don't ask again</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="passkey-skip">Skip for now</Button>
          <Button onClick={handleSetup} disabled={!supported || submitting} data-testid="passkey-setup">{submitting ? 'Setting up…' : 'Set up now'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
