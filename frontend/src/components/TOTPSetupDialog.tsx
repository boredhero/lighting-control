import { useState, useEffect } from 'react'
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
  const [qrImage, setQrImage] = useState('')
  const [code, setCode] = useState('')
  const [debugInfo, setDebugInfo] = useState('')
  const queryClient = useQueryClient()
  useEffect(() => { if (!open) { setStep('generate'); setSecret(''); setQrImage(''); setCode(''); setDebugInfo('') } }, [open])
  const setupMutation = useMutation({
    mutationFn: () => api.post<{ secret: string; qr_uri: string; qr_image: string }>('/auth/me/totp/setup'),
    onSuccess: (data) => { const d = data as { secret: string; qr_uri: string; qr_image: string }; setSecret(d.secret); setQrImage(d.qr_image); setCode(''); setDebugInfo('') ; setStep('verify') },
    onError: (err: Error) => toast.error(err.message),
  })
  const enableMutation = useMutation({
    mutationFn: async () => {
      const debug = await api.post<{ your_code: string; server_code: string; secret_preview: string; match: boolean }>('/auth/me/totp/debug', { code, secret })
      const d = debug as { your_code: string; server_code: string; secret_preview: string; match: boolean }
      setDebugInfo(`Your code: ${d.your_code} | Server expects: ${d.server_code} | Secret: ${d.secret_preview} | Match: ${d.match}`)
      if (!d.match) throw new Error(`Code mismatch — server expects ${d.server_code} for secret ${d.secret_preview}`)
      return api.post('/auth/me/totp/enable', { code, secret })
    },
    onSuccess: () => { toast.success('TOTP enabled!'); queryClient.invalidateQueries({ queryKey: ['user'] }); onOpenChange(false) },
    onError: (err: Error) => { toast.error(err.message); setCode('') },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md">
        <DialogHeader><DialogTitle>Enable TOTP</DialogTitle></DialogHeader>
        {step === 'generate' ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Generate a TOTP secret to add to your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>{setupMutation.isPending ? 'Generating...' : 'Generate Secret'}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app:</p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrImage} alt="TOTP QR Code" className="w-48 h-48" />
            </div>
            <div className="p-2 bg-[var(--surface-2)] rounded">
              <p className="text-xs text-muted-foreground mb-1">Secret (verify this matches your authenticator):</p>
              <p className="font-mono text-sm text-center select-all break-all">{secret}</p>
            </div>
            <div className="flex flex-col gap-2"><Label>Enter the 6-digit code from your app</Label><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="000000" autoFocus /></div>
            {debugInfo && <div className="p-2 bg-[var(--surface-3)] rounded text-xs font-mono break-all">{debugInfo}</div>}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setStep('generate'); setSecret(''); setQrImage(''); setCode(''); setDebugInfo('') }}>Start Over</Button>
              <Button onClick={() => enableMutation.mutate()} disabled={code.length !== 6 || enableMutation.isPending}>{enableMutation.isPending ? 'Verifying...' : 'Enable TOTP'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
