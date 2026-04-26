import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Power, Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { LightingStateControl, type StateValue } from '@/components/LightingStateControl'
import { formatMac } from '@/lib/utils'
import { getDevicePalette } from '@/lib/devicePalette'
import { toast } from 'sonner'
import { useState, useRef } from 'react'

interface Device { id: string; name: string; mac: string; ip: string; model: string | null; bulb_type: string | null; firmware_version: string | null; is_online: boolean; last_state: Record<string, unknown> | null; room_id: string | null; zone_id: string | null }

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: device } = useQuery<Device>({ queryKey: ['device', id], queryFn: () => api.get(`/devices/${id}`) })
  const [stateValue, setStateValue] = useState<StateValue>({})
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlMutation = useMutation({ mutationFn: (state: Record<string, unknown>) => api.post<{ success: boolean }>(`/devices/${id}/control`, { state }), onSuccess: (data) => { const d = data as { success: boolean }; if (!d.success) { toast.error('Device did not respond') }; queryClient.invalidateQueries({ queryKey: ['device', id] }); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const renameMutation = useMutation({ mutationFn: (name: string) => api.post(`/devices/${id}/rename`, { name }), onSuccess: () => { toast.success('Device renamed'); queryClient.invalidateQueries({ queryKey: ['device', id] }); queryClient.invalidateQueries({ queryKey: ['devices'] }); setEditing(false) }, onError: (err: Error) => toast.error(err.message) })
  const [prevDevice, setPrevDevice] = useState<Device | undefined>(device)
  if (device !== prevDevice) {
    setPrevDevice(device)
    if (device?.last_state) setStateValue(device.last_state as StateValue)
  }
  if (!device) return <p className="text-muted-foreground">Loading...</p>
  const handleStateChange = (next: StateValue) => {
    setStateValue(next)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => controlMutation.mutate(next), 300)
  }
  const isOn = device.last_state?.state !== false
  const handleToggle = () => {
    const dimming = typeof stateValue.dimming === 'number' ? stateValue.dimming : 100
    const next = isOn ? { turn_off: true } : { dimming }
    setStateValue(next)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    controlMutation.mutate(next)
  }
  const palette = getDevicePalette(device, 'card')
  const cardStyle = palette ? { backgroundColor: palette.bg, borderColor: palette.border } : undefined
  const cardClass = palette ? 'border' : 'bg-[var(--surface-1)] border-border'
  const iconHaloStyle = palette ? { backgroundColor: palette.iconBg, color: palette.iconFg } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
  const brightnessDisplay = typeof stateValue.dimming === 'number' ? stateValue.dimming : 100
  return (
    <div className="space-y-6 3xl:space-y-8 tv:space-y-12 max-w-2xl 3xl:max-w-4xl tv:max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 3xl:gap-5 tv:gap-7 min-w-0">
          <div className="rounded-full p-3 3xl:p-4 tv:p-6 shrink-0" style={iconHaloStyle}><Lightbulb className="size-7 3xl:size-9 tv:size-14" /></div>
          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-lg font-bold h-9 w-48 tv:h-12 tv:text-2xl tv:w-64" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && editName.trim()) renameMutation.mutate(editName.trim()); if (e.key === 'Escape') setEditing(false) }} />
                <Button variant="ghost" size="icon" onClick={() => { if (editName.trim()) renameMutation.mutate(editName.trim()) }} disabled={!editName.trim() || renameMutation.isPending}><Check className="size-4 tv:size-6" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(false)}><X className="size-4 tv:size-6" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 3xl:gap-3 min-w-0"><h2 className="text-2xl 3xl:text-3xl tv:text-4xl font-bold truncate">{device.name}</h2><Button variant="ghost" size="icon" className="shrink-0 tv:size-10" onClick={() => { setEditName(device.name); setEditing(true) }}><Pencil className="size-[14px] tv:size-5" /></Button></div>
            )}
            <p className="text-muted-foreground 3xl:text-lg tv:text-xl">{device.ip} · {isOn ? `${brightnessDisplay}%` : 'Off'}</p>
          </div>
        </div>
        <Button variant={isOn ? 'default' : 'outline'} size="icon" className="tv:size-14 shrink-0" onClick={handleToggle}><Power className="size-5 tv:size-7" /></Button>
      </div>
      <Card className={cardClass} style={cardStyle}>
        <CardContent className="p-4 3xl:p-6 tv:p-9">
          <LightingStateControl value={stateValue} onChange={handleStateChange} size="full" />
        </CardContent>
      </Card>
      <Card className={cardClass} style={cardStyle}>
        <CardHeader className="3xl:px-6 tv:px-9"><CardTitle className="3xl:text-lg tv:text-2xl">Device Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 3xl:gap-3 text-sm 3xl:text-base tv:text-lg 3xl:px-6 tv:px-9 3xl:pb-3 tv:pb-5">
          <span className="text-muted-foreground">MAC</span><span className="font-mono">{formatMac(device.mac)}</span>
          <span className="text-muted-foreground">Model</span><span>{device.model || 'Unknown'}</span>
          <span className="text-muted-foreground">Type</span><span>{device.bulb_type || 'Unknown'}</span>
          <span className="text-muted-foreground">Firmware</span><span>{device.firmware_version || 'Unknown'}</span>
          <span className="text-muted-foreground">Status</span><Badge variant={device.is_online ? 'default' : 'secondary'}>{device.is_online ? 'Online' : 'Offline'}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
