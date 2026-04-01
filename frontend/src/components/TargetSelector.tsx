import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

interface Room { id: string; name: string }
interface Zone { id: string; name: string }
interface Group { id: string; name: string; device_ids: string[] }
interface Device { id: string; name: string; is_online: boolean }

export interface TargetConfig {
  target_type: string
  target_id: string | null
  exclude_device_ids: string[] | null
  state: Record<string, unknown>
}

interface TargetSelectorProps {
  targets: TargetConfig[]
  onChange: (targets: TargetConfig[]) => void
}

function SingleTarget({ target, index, onUpdate, onRemove }: { target: TargetConfig; index: number; onUpdate: (t: TargetConfig) => void; onRemove: () => void }) {
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: () => api.get('/rooms') })
  const { data: zones = [] } = useQuery<Zone[]>({ queryKey: ['zones'], queryFn: () => api.get('/zones') })
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ['groups'], queryFn: () => api.get('/groups') })
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Target {index + 1}</Label>
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 size={14} className="text-destructive" /></Button>
      </div>
      <Select value={target.target_type} onValueChange={(v) => { if (v) onUpdate({ ...target, target_type: v, target_id: null }) }}>
        <SelectTrigger><SelectValue placeholder="Select target type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="device">Single Device</SelectItem>
          <SelectItem value="room">Entire Room</SelectItem>
          <SelectItem value="zone">Entire Zone</SelectItem>
          <SelectItem value="group">Device Group</SelectItem>
          <SelectItem value="all">All Devices</SelectItem>
          <SelectItem value="all_except">All Except...</SelectItem>
        </SelectContent>
      </Select>
      {target.target_type === 'device' && (
        <Select value={target.target_id ?? ''} onValueChange={(v) => onUpdate({ ...target, target_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
          <SelectContent>{devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{!d.is_online ? ' (offline)' : ''}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {target.target_type === 'room' && (
        <Select value={target.target_id ?? ''} onValueChange={(v) => onUpdate({ ...target, target_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
          <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {target.target_type === 'zone' && (
        <Select value={target.target_id ?? ''} onValueChange={(v) => onUpdate({ ...target, target_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
          <SelectContent>{zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {target.target_type === 'group' && (
        <Select value={target.target_id ?? ''} onValueChange={(v) => onUpdate({ ...target, target_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
          <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  )
}

export function TargetSelector({ targets, onChange }: TargetSelectorProps) {
  const addTarget = () => onChange([...targets, { target_type: 'all', target_id: null, exclude_device_ids: null, state: {} }])
  const updateTarget = (index: number, t: TargetConfig) => { const next = [...targets]; next[index] = t; onChange(next) }
  const removeTarget = (index: number) => onChange(targets.filter((_, i) => i !== index))
  return (
    <div className="flex flex-col gap-3">
      {targets.map((t, i) => <SingleTarget key={i} target={t} index={i} onUpdate={(u) => updateTarget(i, u)} onRemove={() => removeTarget(i)} />)}
      <Button variant="outline" size="sm" onClick={addTarget}><Plus size={14} className="mr-1" />Add Target</Button>
    </div>
  )
}
