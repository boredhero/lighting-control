import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Lightbulb } from 'lucide-react'
import { useState } from 'react'

interface Device { id: string; name: string; mac: string; ip: string; is_online: boolean; bulb_type: string | null; room_id: string | null; last_state: Record<string, unknown> | null }

export function DevicesPage() {
  const [search, setSearch] = useState('')
  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const filtered = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.mac.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Devices</h2>
        <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading devices...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No devices found. Make sure your WiZ devices are on the network.</p>
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
