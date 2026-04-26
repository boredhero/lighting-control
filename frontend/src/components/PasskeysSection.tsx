import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Fingerprint, Trash2, Pencil, Plus, Smartphone, KeyRound, Cloud, Puzzle } from 'lucide-react'
import { toast } from 'sonner'
import { listPasskeys, enrollPasskey, renamePasskey, deletePasskey, browserSupportsWebAuthn, isUserCancellation, type PasskeySummary } from '@/lib/passkey'
import { lookupAaguid, type PasskeyIcon } from '@/lib/aaguid'

const ICON_FOR: Record<PasskeyIcon, typeof Fingerprint> = {
  platform: Smartphone,
  key: KeyRound,
  cloud: Cloud,
  extension: Puzzle,
}

export function PasskeysSection() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<PasskeySummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<PasskeySummary | null>(null)
  const supported = browserSupportsWebAuthn()
  const { data: passkeys = [], isLoading } = useQuery<PasskeySummary[]>({ queryKey: ['passkeys'], queryFn: listPasskeys })
  const enrollMutation = useMutation({
    mutationFn: (n: string) => enrollPasskey(n),
    onSuccess: () => { toast.success('Passkey added'); setAddOpen(false); setName(''); queryClient.invalidateQueries({ queryKey: ['passkeys'] }) },
    onError: (err: Error) => { if (!isUserCancellation(err)) toast.error(err.message) },
  })
  const renameMutation = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => renamePasskey(id, n),
    onSuccess: () => { toast.success('Passkey renamed'); setRenaming(null); queryClient.invalidateQueries({ queryKey: ['passkeys'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePasskey(id),
    onSuccess: () => { toast.success('Passkey revoked'); setConfirmDelete(null); queryClient.invalidateQueries({ queryKey: ['passkeys'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Card className="bg-[var(--surface-1)] border-border 3xl:py-6 tv:py-10 3xl:gap-6 tv:gap-10" data-testid="passkeys-section">
      <CardHeader className="3xl:px-6 tv:px-10"><CardTitle className="flex items-center gap-2 3xl:gap-3 3xl:text-xl tv:text-3xl"><Fingerprint className="size-[18px] 3xl:size-6 tv:size-9" />Passkeys</CardTitle></CardHeader>
      <CardContent className="space-y-4 3xl:space-y-6 tv:space-y-8 3xl:px-6 tv:px-10">
        <p className="text-xs 3xl:text-sm tv:text-base text-muted-foreground">Sign in faster using your fingerprint, face, or a security key. {supported ? '' : 'Your browser does not support passkeys.'}</p>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={!supported} className="3xl:h-10 tv:h-14 3xl:text-base tv:text-xl 3xl:px-4 tv:px-7" data-testid="passkey-add-button">
          <Plus className="size-[14px] 3xl:size-5 tv:size-6 mr-1" />Add a passkey
        </Button>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && passkeys.length === 0 && <p className="text-xs 3xl:text-sm text-muted-foreground" data-testid="passkeys-empty">No passkeys yet.</p>}
        {passkeys.length > 0 && (
          <div className="space-y-2 3xl:space-y-3 tv:space-y-5" data-testid="passkeys-list">
            {passkeys.map((pk) => {
              const meta = lookupAaguid(pk.aaguid, pk.transports)
              const Icon = ICON_FOR[meta.icon]
              return (
                <div key={pk.id} className="flex items-center justify-between gap-3 py-2 px-3 3xl:py-3 3xl:px-4 tv:py-5 tv:px-7 bg-[var(--surface-2)] rounded-lg" data-testid={`passkey-row-${pk.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm 3xl:text-base tv:text-xl truncate">{pk.name}</span>
                        {pk.non_uv_only && <Badge variant="outline" className="text-[10px]">2FA-only</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{meta.name}{pk.last_used_at ? ` · last used ${new Date(pk.last_used_at).toLocaleDateString()}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setRenaming(pk); setRenameValue(pk.name) }} data-testid={`passkey-rename-${pk.id}`}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(pk)} data-testid={`passkey-delete-${pk.id}`}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a passkey</DialogTitle><DialogDescription>You'll be prompted by your browser to choose your authenticator.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="passkey-add-name">Name</Label>
            <Input id="passkey-add-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="e.g. My YubiKey" data-testid="passkey-add-name-input" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => enrollMutation.mutate(name.trim() || 'Passkey')} disabled={enrollMutation.isPending} data-testid="passkey-add-confirm">{enrollMutation.isPending ? 'Adding…' : 'Continue'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!renaming} onOpenChange={(o) => { if (!o) setRenaming(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename passkey</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={64} data-testid="passkey-rename-input" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={() => renaming && renameMutation.mutate({ id: renaming.id, n: renameValue })} disabled={renameMutation.isPending} data-testid="passkey-rename-confirm">{renameMutation.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke this passkey?</DialogTitle>
            <DialogDescription>
              {confirmDelete && passkeys.length === 1
                ? "This is your last passkey. You'll need to use your password (and TOTP if enabled) to sign in."
                : `"${confirmDelete?.name}" will no longer work for signing in.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)} disabled={deleteMutation.isPending} data-testid="passkey-delete-confirm">{deleteMutation.isPending ? 'Revoking…' : 'Revoke'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
