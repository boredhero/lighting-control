import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TargetSelector, type TargetConfig } from '@/components/TargetSelector'
import { LightingStateControl } from '@/components/LightingStateControl'
import { toast } from 'sonner'

interface ExistingQuickAction {
  id: string
  name: string
  targets: TargetConfig[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  quickAction?: ExistingQuickAction | null
}

type Step = 'name' | 'targets' | 'states' | 'review'

const BLANK_TARGETS: TargetConfig[] = [{ target_type: 'all', target_id: null, exclude_device_ids: null, state: { dimming: 100 } }]

export function QuickActionDialog({ open, onOpenChange, quickAction }: Props) {
  const isEdit = !!quickAction
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [targets, setTargets] = useState<TargetConfig[]>(BLANK_TARGETS)
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!open) return
    if (quickAction) {
      setName(quickAction.name)
      setTargets(quickAction.targets.map((t) => ({ target_type: t.target_type, target_id: t.target_id, exclude_device_ids: t.exclude_device_ids, state: t.state })))
    } else {
      setName('')
      setTargets(BLANK_TARGETS)
    }
    setStep('name')
  }, [open, quickAction])
  const saveMutation = useMutation({
    mutationFn: (data: { name: string; targets: TargetConfig[] }) => isEdit ? api.put(`/quick-actions/${quickAction!.id}`, data) : api.post('/quick-actions', data),
    onSuccess: () => { toast.success(isEdit ? 'Quick action updated' : 'Quick action created'); queryClient.invalidateQueries({ queryKey: ['quick-actions'] }); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  const updateTargetState = (index: number, state: Record<string, unknown>) => { const next = [...targets]; next[index] = { ...next[index], state }; setTargets(next) }
  const canProceedName = name.trim().length > 0
  const canProceedTargets = targets.length > 0 && targets.every((t) => t.target_type === 'all' || t.target_type === 'all_except' || t.target_id)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Quick Action' : step === 'name' ? 'Name Your Quick Action' : step === 'targets' ? 'Select Targets' : step === 'states' ? 'Configure States' : 'Review'}</DialogTitle></DialogHeader>
        {step === 'name' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Movie Night" autoFocus /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!canProceedName} onClick={() => setStep('targets')}>Next</Button>
            </div>
          </div>
        )}
        {step === 'targets' && (
          <div className="flex flex-col gap-4">
            <TargetSelector targets={targets} onChange={setTargets} />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('name')}>Back</Button>
              <Button disabled={!canProceedTargets} onClick={() => setStep('states')}>Next</Button>
            </div>
          </div>
        )}
        {step === 'states' && (
          <div className="flex flex-col gap-4">
            {targets.map((t, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Target {i + 1}: {t.target_type}{t.target_id ? ` (${t.target_id.slice(0, 8)}...)` : ''}</Label>
                <LightingStateControl value={t.state} onChange={(s) => updateTargetState(i, s)} size="compact" />
              </div>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('targets')}>Back</Button>
              <Button onClick={() => setStep('review')}>Next</Button>
            </div>
          </div>
        )}
        {step === 'review' && (
          <div className="flex flex-col gap-4">
            <div className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{name}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Targets:</span> <span className="font-medium">{targets.length}</span></div>
            {targets.map((t, i) => (
              <div key={i} className="text-xs p-2 bg-[var(--surface-2)] rounded">
                <span className="font-medium">Target {i + 1}:</span> {t.target_type} → {JSON.stringify(t.state)}
              </div>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('states')}>Back</Button>
              <Button onClick={() => saveMutation.mutate({ name, targets })} disabled={saveMutation.isPending}>{saveMutation.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Quick Action')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
