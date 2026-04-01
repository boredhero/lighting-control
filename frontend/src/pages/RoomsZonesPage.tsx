import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, DoorOpen, MapPin, Users } from 'lucide-react'

interface Room { id: string; name: string; icon: string | null }
interface Zone { id: string; name: string; icon: string | null }
interface Group { id: string; name: string; icon: string | null; device_ids: string[] }

export function RoomsZonesPage() {
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: () => api.get('/rooms') })
  const { data: zones = [] } = useQuery<Zone[]>({ queryKey: ['zones'], queryFn: () => api.get('/zones') })
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ['groups'], queryFn: () => api.get('/groups') })
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Rooms, Zones & Groups</h2>
      <Tabs defaultValue="rooms">
        <TabsList><TabsTrigger value="rooms">Rooms</TabsTrigger><TabsTrigger value="zones">Zones</TabsTrigger><TabsTrigger value="groups">Groups</TabsTrigger></TabsList>
        <TabsContent value="rooms" className="space-y-3 mt-4">
          <Button size="sm"><Plus size={14} className="mr-1" />Add Room</Button>
          {rooms.map((room) => (<Card key={room.id} className="bg-[var(--surface-1)] border-border"><CardContent className="flex items-center gap-3 p-4"><DoorOpen size={18} /><span className="font-medium">{room.name}</span></CardContent></Card>))}
        </TabsContent>
        <TabsContent value="zones" className="space-y-3 mt-4">
          <Button size="sm"><Plus size={14} className="mr-1" />Add Zone</Button>
          {zones.map((zone) => (<Card key={zone.id} className="bg-[var(--surface-1)] border-border"><CardContent className="flex items-center gap-3 p-4"><MapPin size={18} /><span className="font-medium">{zone.name}</span></CardContent></Card>))}
        </TabsContent>
        <TabsContent value="groups" className="space-y-3 mt-4">
          <Button size="sm"><Plus size={14} className="mr-1" />Add Group</Button>
          {groups.map((group) => (<Card key={group.id} className="bg-[var(--surface-1)] border-border"><CardContent className="flex items-center gap-3 p-4"><Users size={18} /><div><span className="font-medium">{group.name}</span><span className="text-xs text-muted-foreground ml-2">{group.device_ids.length} devices</span></div></CardContent></Card>))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
