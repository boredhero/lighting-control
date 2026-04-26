import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Power, Pencil, Check, X, Thermometer, Palette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HexColorPicker } from 'react-colorful'
import { formatMac } from '@/lib/utils'
import { getDevicePalette } from '@/lib/devicePalette'
import { toast } from 'sonner'
import { useState, useRef } from 'react'

interface Device { id: string; name: string; mac: string; ip: string; model: string | null; bulb_type: string | null; firmware_version: string | null; is_online: boolean; last_state: Record<string, unknown> | null; room_id: string | null; zone_id: string | null }

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

function tempToLabel(temp: number): string {
  if (temp <= 2700) return 'Warm White'
  if (temp <= 4000) return 'Neutral'
  if (temp <= 5000) return 'Cool White'
  return 'Daylight'
}

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: device } = useQuery<Device>({ queryKey: ['device', id], queryFn: () => api.get(`/devices/${id}`) })
  const [color, setColor] = useState('#F59E0B')
  const [brightness, setBrightness] = useState(100)
  const [colorTemp, setColorTemp] = useState(4000)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tempTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlMutation = useMutation({ mutationFn: (state: Record<string, unknown>) => api.post<{ success: boolean }>(`/devices/${id}/control`, { state }), onSuccess: (data) => { const d = data as { success: boolean }; if (!d.success) { toast.error('Device did not respond') }; queryClient.invalidateQueries({ queryKey: ['device', id] }); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const renameMutation = useMutation({ mutationFn: (name: string) => api.post(`/devices/${id}/rename`, { name }), onSuccess: () => { toast.success('Device renamed'); queryClient.invalidateQueries({ queryKey: ['device', id] }); queryClient.invalidateQueries({ queryKey: ['devices'] }); setEditing(false) }, onError: (err: Error) => toast.error(err.message) })
  const [prevDevice, setPrevDevice] = useState<Device | undefined>(device)
  if (device !== prevDevice) {
    setPrevDevice(device)
    if (device?.last_state) {
      const s = device.last_state
      if (typeof s.dimming === 'number') setBrightness(s.dimming as number)
      if (typeof s.r === 'number' && typeof s.g === 'number' && typeof s.b === 'number') setColor(rgbToHex(s.r as number, s.g as number, s.b as number))
      if (typeof s.temp === 'number') setColorTemp(s.temp as number)
    }
  }
  if (!device) return <p className="text-muted-foreground">Loading...</p>
  const hexToRgb = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); return { r, g, b } }
  const handleColorChange = (hex: string) => { setColor(hex); if (colorTimer.current) clearTimeout(colorTimer.current); colorTimer.current = setTimeout(() => { const { r, g, b } = hexToRgb(hex); controlMutation.mutate({ r, g, b, dimming: brightness }) }, 300) }
  const handleBrightness = (value: number | readonly number[]) => { const v = Array.isArray(value) ? value[0] : value; setBrightness(v); if (brightnessTimer.current) clearTimeout(brightnessTimer.current); brightnessTimer.current = setTimeout(() => { controlMutation.mutate({ dimming: v }) }, 300) }
  const handleColorTemp = (value: number | readonly number[]) => { const v = Array.isArray(value) ? value[0] : value; setColorTemp(v); if (tempTimer.current) clearTimeout(tempTimer.current); tempTimer.current = setTimeout(() => { controlMutation.mutate({ temp: v, dimming: brightness }) }, 300) }
  const isOn = device.last_state?.state !== false
  const handleToggle = () => { controlMutation.mutate(isOn ? { turn_off: true } : { dimming: brightness }) }
  const palette = getDevicePalette(device, 'card')
  const cardStyle = palette ? { backgroundColor: palette.bg, borderColor: palette.border } : undefined
  const cardClass = palette ? 'border' : 'bg-[var(--surface-1)] border-border'
  const iconHaloStyle = palette ? { backgroundColor: palette.iconBg, color: palette.iconFg } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
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
            <p className="text-muted-foreground 3xl:text-lg tv:text-xl">{device.ip} · {isOn ? `${brightness}%` : 'Off'}</p>
          </div>
        </div>
        <Button variant={isOn ? 'default' : 'outline'} size="icon" className="tv:size-14 shrink-0" onClick={handleToggle}><Power className="size-5 tv:size-7" /></Button>
      </div>
      <Card className={cardClass} style={cardStyle}>
        <CardContent className="p-4 3xl:p-6 tv:p-9">
          <Tabs defaultValue={device.last_state?.temp ? 'temp' : 'color'}>
            <TabsList className="mb-4 3xl:mb-6 tv:h-12"><TabsTrigger value="color" className="tv:text-lg tv:px-5"><Palette className="size-[14px] tv:size-5 mr-1" />Color</TabsTrigger><TabsTrigger value="temp" className="tv:text-lg tv:px-5"><Thermometer className="size-[14px] tv:size-5 mr-1" />Temperature</TabsTrigger></TabsList>
            <TabsContent value="color" className="flex flex-col items-center gap-4 3xl:gap-6">
              <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%', maxWidth: 'min(28rem, 100%)' }} />
              <p className="text-sm 3xl:text-base tv:text-xl text-muted-foreground font-mono">{color}</p>
            </TabsContent>
            <TabsContent value="temp" className="flex flex-col gap-4 3xl:gap-6">
              <div className="flex items-center gap-3 3xl:gap-5"><span className="text-xs 3xl:text-sm tv:text-lg text-muted-foreground w-14 tv:w-20">2200K</span><Slider value={[colorTemp]} onValueChange={handleColorTemp} min={2200} max={6500} step={100} className="flex-1" /><span className="text-xs 3xl:text-sm tv:text-lg font-medium w-14 tv:w-20 text-right">{colorTemp}K</span></div>
              <p className="text-sm 3xl:text-base tv:text-xl text-muted-foreground text-center">{tempToLabel(colorTemp)}</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card className={cardClass} style={cardStyle}>
        <CardHeader className="3xl:px-6 tv:px-9 3xl:pt-2 tv:pt-4"><CardTitle className="3xl:text-lg tv:text-2xl">Brightness</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4 3xl:gap-6 3xl:px-6 tv:px-9 3xl:pb-2 tv:pb-4">
          <span className="text-sm 3xl:text-base tv:text-lg text-muted-foreground w-8 tv:w-14">0%</span>
          <Slider value={[brightness]} onValueChange={handleBrightness} max={100} step={1} className="flex-1" />
          <span className="text-sm 3xl:text-base tv:text-lg font-medium w-10 tv:w-16 text-right">{brightness}%</span>
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
