import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lightbulb, Radar, Download, Upload } from 'lucide-react'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { getDevicePalette, getDeviceBrightness } from '@/lib/devicePalette'

interface Device { id: string; name: string; mac: string; ip: string; is_online: boolean; bulb_type: string | null; room_id: string | null; last_state: Record<string, unknown> | null }

export function DevicesPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const discoverMutation = useMutation({ mutationFn: () => api.post<{ discovered: number }>('/devices/discover'), onSuccess: (data) => { toast.success(`Discovery complete: ${(data as { discovered: number }).discovered} device(s) found`); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const importMutation = useMutation({ mutationFn: (mappings: { mac: string; name: string }[]) => api.post<{ updated: number; total: number }>('/devices/import', mappings), onSuccess: (data) => { const d = data as { updated: number; total: number }; toast.success(`Restored ${d.updated}/${d.total} device names`); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const handleExport = async () => {
    const data = await api.get<{ mac: string; name: string }[]>('/devices/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'lighting-devices.json'; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${(data as { mac: string; name: string }[]).length} devices`)
  }
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { try { const mappings = JSON.parse(reader.result as string); importMutation.mutate(mappings) } catch { toast.error('Invalid JSON file') } }
    reader.readAsText(file)
    e.target.value = ''
  }
  const filtered = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.mac.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Devices</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Button variant="outline" size="icon" onClick={handleExport} title="Export device names"><Download size={16} /></Button>
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Import device names"><Upload size={16} /></Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending}><Radar size={16} className="mr-2" />{discoverMutation.isPending ? 'Scanning...' : 'Scan Network'}</Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading devices...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No devices found. Make sure your WiZ devices are on the same network.</p>
          <Button onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending}><Radar size={16} className="mr-2" />{discoverMutation.isPending ? 'Scanning...' : 'Scan Network'}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((device) => {
            const palette = getDevicePalette(device, 'card')
            const brightness = getDeviceBrightness(device)
            const isOff = palette === null
            const cardStyle = palette ? { backgroundColor: palette.bg, borderColor: palette.border } : undefined
            const iconStyle = palette ? { backgroundColor: palette.iconBg, color: palette.iconFg } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            const pillStyle = palette ? { backgroundColor: palette.pillBg, color: palette.pillText } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            return (
              <Link key={device.id} to={`/devices/${device.id}`}>
                <Card className={isOff ? 'bg-[var(--surface-1)] border-border hover:bg-[var(--surface-2)] transition-colors cursor-pointer' : 'border hover:brightness-110 transition-all cursor-pointer'} style={cardStyle}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-full p-2" style={iconStyle}><Lightbulb size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{device.name}</p>
                      <p className="text-xs truncate" style={{ color: palette ? palette.iconFg : 'var(--text-secondary)', opacity: palette ? 0.85 : 1 }}>{device.ip}{brightness !== null ? ` · ${brightness}%` : ''}</p>
                    </div>
                    <span className="inline-flex h-5 items-center rounded-full px-2 text-xs font-medium" style={pillStyle}>{isOff ? 'Off' : 'Online'}</span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
