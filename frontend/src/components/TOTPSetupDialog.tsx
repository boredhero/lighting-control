import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TOTPSetupDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<'generate' | 'verify'>('generate')
  const [secret, setSecret] = useState('')
  const [qrUri, setQrUri] = useState('')
  const [code, setCode] = useState('')
  const queryClient = useQueryClient()
  const setupMutation = useMutation({
    mutationFn: () => api.post<{ secret: string; qr_uri: string }>('/auth/me/totp/setup'),
    onSuccess: (data) => { const d = data as { secret: string; qr_uri: string }; setSecret(d.secret); setQrUri(d.qr_uri); setStep('verify') },
    onError: (err: Error) => toast.error(err.message),
  })
  const enableMutation = useMutation({
    mutationFn: () => api.post('/auth/me/totp/enable', { code, partial_token: secret }),
    onSuccess: () => { toast.success('TOTP enabled!'); queryClient.invalidateQueries({ queryKey: ['user'] }); resetAndClose() },
    onError: (err: Error) => toast.error(err.message),
  })
  const resetAndClose = () => { setStep('generate'); setSecret(''); setQrUri(''); setCode(''); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-sm">
        <DialogHeader><DialogTitle>Enable TOTP</DialogTitle></DialogHeader>
        {step === 'generate' ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a TOTP secret to add to your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>{setupMutation.isPending ? 'Generating...' : 'Generate Secret'}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Scan this QR URI in your authenticator app, or enter the secret manually:</p>
            <div className="p-3 bg-[var(--surface-2)] rounded text-xs font-mono break-all select-all">{qrUri}</div>
            <div className="p-2 bg-[var(--surface-2)] rounded text-xs font-mono text-center select-all">{secret}</div>
            <div className="flex flex-col gap-2"><Label>Enter the 6-digit code from your app</Label><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="000000" autoFocus /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button onClick={() => enableMutation.mutate()} disabled={code.length !== 6 || enableMutation.isPending}>{enableMutation.isPending ? 'Verifying...' : 'Enable TOTP'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
