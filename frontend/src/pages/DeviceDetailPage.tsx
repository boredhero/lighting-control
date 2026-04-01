import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Power } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

interface Device { id: string; name: string; mac: string; ip: string; model: string | null; bulb_type: string | null; firmware_version: string | null; is_online: boolean; last_state: Record<string, unknown> | null; room_id: string | null; zone_id: string | null }

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: device } = useQuery<Device>({ queryKey: ['device', id], queryFn: () => api.get(`/devices/${id}`) })
  const [color, setColor] = useState('#F59E0B')
  const [brightness, setBrightness] = useState(100)
  const controlMutation = useMutation({ mutationFn: (state: Record<string, unknown>) => api.post(`/devices/${id}/control`, { state }), onSuccess: () => { toast.success('Device updated'); queryClient.invalidateQueries({ queryKey: ['device', id] }); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  useEffect(() => {
    if (device?.last_state) {
      const s = device.last_state
      if (s.dimming) setBrightness(s.dimming as number)
    }
  }, [device])
  if (!device) return <p className="text-muted-foreground">Loading...</p>
  const hexToRgb = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); return { r, g, b } }
  const handleColorChange = (hex: string) => { setColor(hex); const { r, g, b } = hexToRgb(hex); controlMutation.mutate({ r, g, b, dimming: brightness }) }
  const handleBrightness = (value: number | readonly number[]) => { const v = Array.isArray(value) ? value[0] : value; setBrightness(v); controlMutation.mutate({ dimming: v }) }
  const handleToggle = () => { controlMutation.mutate({ state: device.last_state?.state === false ? true : false }) }
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${device.is_online ? 'bg-[var(--color-amber)]/20 text-[var(--color-amber)]' : 'bg-muted text-muted-foreground'}`}><Lightbulb size={28} /></div>
          <div><h2 className="text-2xl font-bold">{device.name}</h2><p className="text-muted-foreground">{device.ip}</p></div>
        </div>
        <Button variant="outline" size="icon" onClick={handleToggle}><Power size={20} /></Button>
      </div>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle>Color</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%', maxWidth: 280 }} />
          <p className="text-sm text-muted-foreground">{color}</p>
        </CardContent>
      </Card>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle>Brightness</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground w-8">0%</span>
          <Slider value={[brightness]} onValueChange={handleBrightness} max={100} step={1} className="flex-1" />
          <span className="text-sm font-medium w-10 text-right">{brightness}%</span>
        </CardContent>
      </Card>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle>Device Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">MAC</span><span>{device.mac}</span>
          <span className="text-muted-foreground">Model</span><span>{device.model || 'Unknown'}</span>
          <span className="text-muted-foreground">Type</span><span>{device.bulb_type || 'Unknown'}</span>
          <span className="text-muted-foreground">Firmware</span><span>{device.firmware_version || 'Unknown'}</span>
          <span className="text-muted-foreground">Status</span><Badge variant={device.is_online ? 'default' : 'secondary'}>{device.is_online ? 'Online' : 'Offline'}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
