import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TargetSelector, type TargetConfig } from '@/components/TargetSelector'
import { StateConfigurator } from '@/components/StateConfigurator'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TriggerConfig {
  trigger_type: string
  cron_expression: string | null
  offset_minutes: number | null
}

type Step = 'name' | 'triggers' | 'targets' | 'states' | 'review'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CronBuilder({ trigger, onUpdate }: { trigger: TriggerConfig; onUpdate: (t: TriggerConfig) => void }) {
  const [advanced, setAdvanced] = useState(false)
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, true, true])
  const [hour, setHour] = useState('20')
  const [minute, setMinute] = useState('00')
  const buildCron = (days: boolean[], h: string, m: string) => {
    const dayNums = days.map((d, i) => d ? i + 1 : null).filter((d) => d !== null)
    const dayStr = dayNums.length === 7 ? '*' : dayNums.join(',')
    return `${m} ${h} * * ${dayStr}`
  }
  const handleDayToggle = (i: number) => { const next = [...selectedDays]; next[i] = !next[i]; setSelectedDays(next); onUpdate({ ...trigger, cron_expression: buildCron(next, hour, minute) }) }
  const handleTime = (h: string, m: string) => { setHour(h); setMinute(m); onUpdate({ ...trigger, cron_expression: buildCron(selectedDays, h, m) }) }
  return (
    <div className="flex flex-col gap-3">
      {!advanced ? (
        <>
          <div className="flex gap-1 flex-wrap">{DAYS.map((d, i) => (<button key={d} onClick={() => handleDayToggle(i)} className={`px-2 py-1 text-xs rounded ${selectedDays[i] ? 'bg-primary text-primary-foreground' : 'bg-[var(--surface-3)] text-muted-foreground'}`}>{d}</button>))}</div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-10">Time</Label>
            <Input type="number" min={0} max={23} value={hour} onChange={(e) => handleTime(e.target.value, minute)} className="w-16 text-center" />
            <span>:</span>
            <Input type="number" min={0} max={59} value={minute} onChange={(e) => handleTime(hour, e.target.value)} className="w-16 text-center" />
          </div>
          <button onClick={() => setAdvanced(true)} className="text-xs text-muted-foreground underline self-start">Advanced (raw cron)</button>
        </>
      ) : (
        <>
          <Input value={trigger.cron_expression || ''} onChange={(e) => onUpdate({ ...trigger, cron_expression: e.target.value })} placeholder="0 20 * * 1,2,3,4,5" />
          <button onClick={() => setAdvanced(false)} className="text-xs text-muted-foreground underline self-start">Simple mode</button>
        </>
      )}
    </div>
  )
}

export function CreateScheduleDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(50)
  const [triggers, setTriggers] = useState<TriggerConfig[]>([{ trigger_type: 'cron', cron_expression: '0 20 * * *', offset_minutes: null }])
  const [targets, setTargets] = useState<TargetConfig[]>([{ target_type: 'all', target_id: null, exclude_device_ids: null, state: { dimming: 100 } }])
  const queryClient = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (data: { name: string; priority: number; triggers: TriggerConfig[]; targets: TargetConfig[] }) => api.post('/schedules', data),
    onSuccess: () => { toast.success('Schedule created'); queryClient.invalidateQueries({ queryKey: ['schedules'] }); resetAndClose() },
    onError: (err: Error) => toast.error(err.message),
  })
  const resetAndClose = () => { setStep('name'); setName(''); setPriority(50); setTriggers([{ trigger_type: 'cron', cron_expression: '0 20 * * *', offset_minutes: null }]); setTargets([{ target_type: 'all', target_id: null, exclude_device_ids: null, state: { dimming: 100 } }]); onOpenChange(false) }
  const addTrigger = () => setTriggers([...triggers, { trigger_type: 'cron', cron_expression: '0 0 * * *', offset_minutes: null }])
  const updateTrigger = (i: number, t: TriggerConfig) => { const next = [...triggers]; next[i] = t; setTriggers(next) }
  const removeTrigger = (i: number) => setTriggers(triggers.filter((_, idx) => idx !== i))
  const updateTargetState = (i: number, state: Record<string, unknown>) => { const next = [...targets]; next[i] = { ...next[i], state }; setTargets(next) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{step === 'name' ? 'Name & Priority' : step === 'triggers' ? 'When Should It Run?' : step === 'targets' ? 'What Should It Control?' : step === 'states' ? 'Configure States' : 'Review'}</DialogTitle></DialogHeader>
        {step === 'name' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>Schedule Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly Shutdown" autoFocus /></div>
            <div className="flex flex-col gap-2">
              <Label>Priority ({priority})</Label>
              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Low</span><Slider value={[priority]} onValueChange={(v) => setPriority(Array.isArray(v) ? v[0] : v)} max={100} step={1} className="flex-1" /><span className="text-xs text-muted-foreground">High</span></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={resetAndClose}>Cancel</Button><Button disabled={!name.trim()} onClick={() => setStep('triggers')}>Next</Button></div>
          </div>
        )}
        {step === 'triggers' && (
          <div className="flex flex-col gap-4">
            {triggers.map((t, i) => (
              <div key={i} className="flex flex-col gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Trigger {i + 1}</Label>
                  {triggers.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeTrigger(i)}><Trash2 size={14} className="text-destructive" /></Button>}
                </div>
                <Select value={t.trigger_type} onValueChange={(v) => { if (v) updateTrigger(i, { ...t, trigger_type: v }) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cron">Time / Day Schedule</SelectItem>
                    <SelectItem value="sunrise">Sunrise</SelectItem>
                    <SelectItem value="sunset">Sunset</SelectItem>
                    <SelectItem value="webhook">External Webhook</SelectItem>
                  </SelectContent>
                </Select>
                {t.trigger_type === 'cron' && <CronBuilder trigger={t} onUpdate={(u) => updateTrigger(i, u)} />}
                {(t.trigger_type === 'sunrise' || t.trigger_type === 'sunset') && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12">Offset</Label>
                    <Slider value={[t.offset_minutes || 0]} onValueChange={(v) => updateTrigger(i, { ...t, offset_minutes: Array.isArray(v) ? v[0] : v })} min={-60} max={60} step={5} className="flex-1" />
                    <span className="text-xs w-16 text-right">{(t.offset_minutes || 0) > 0 ? '+' : ''}{t.offset_minutes || 0} min</span>
                  </div>
                )}
                {t.trigger_type === 'webhook' && <p className="text-xs text-muted-foreground">A webhook URL with a secret will be generated after creation.</p>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addTrigger}><Plus size={14} className="mr-1" />Add Trigger</Button>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('name')}>Back</Button><Button onClick={() => setStep('targets')}>Next</Button></div>
          </div>
        )}
        {step === 'targets' && (
          <div className="flex flex-col gap-4">
            <TargetSelector targets={targets} onChange={setTargets} />
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('triggers')}>Back</Button><Button onClick={() => setStep('states')}>Next</Button></div>
          </div>
        )}
        {step === 'states' && (
          <div className="flex flex-col gap-4">
            {targets.map((t, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Target {i + 1}: {t.target_type}</Label>
                <StateConfigurator state={t.state} onChange={(s) => updateTargetState(i, s)} />
              </div>
            ))}
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('targets')}>Back</Button><Button onClick={() => setStep('review')}>Review</Button></div>
          </div>
        )}
        {step === 'review' && (
          <div className="flex flex-col gap-4">
            <div className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{name}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Priority:</span> <span className="font-medium">{priority}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Triggers:</span> <span className="font-medium">{triggers.length}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Targets:</span> <span className="font-medium">{targets.length}</span></div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('states')}>Back</Button>
              <Button onClick={() => createMutation.mutate({ name, priority, triggers, targets })} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Schedule'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
