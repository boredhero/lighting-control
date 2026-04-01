import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lightbulb, Radar } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Device { id: string; name: string; mac: string; ip: string; is_online: boolean; bulb_type: string | null; room_id: string | null; last_state: Record<string, unknown> | null }

export function DevicesPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const discoverMutation = useMutation({ mutationFn: () => api.post<{ discovered: number }>('/devices/discover'), onSuccess: (data) => { toast.success(`Discovery complete: ${(data as { discovered: number }).discovered} device(s) found`); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const filtered = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.mac.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Devices</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
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
          {filtered.map((device) => (
            <Link key={device.id} to={`/devices/${device.id}`}>
              <Card className="bg-[var(--surface-1)] border-border hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`rounded-full p-2 ${device.is_online ? 'bg-[var(--color-amber)]/20 text-[var(--color-amber)]' : 'bg-muted text-muted-foreground'}`}><Lightbulb size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{device.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{device.ip}</p>
                  </div>
                  <Badge variant={device.is_online ? 'default' : 'secondary'}>{device.is_online ? 'Online' : 'Offline'}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
