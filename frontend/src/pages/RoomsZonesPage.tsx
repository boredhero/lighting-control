import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, DoorOpen, MapPin, Users, Lightbulb, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface HierarchyDevice { id: string; name: string; mac: string; ip: string; is_online: boolean; last_state: Record<string, unknown> | null }
interface HierarchyZone { id: string; name: string; icon: string | null; devices: HierarchyDevice[] }
interface HierarchyRoom { id: string; name: string; icon: string | null; zones: HierarchyZone[]; devices: HierarchyDevice[] }
interface HierarchyGroup { id: string; name: string; icon: string | null; device_ids: string[] }
interface Hierarchy { rooms: HierarchyRoom[]; unassigned: HierarchyDevice[]; groups: HierarchyGroup[] }
interface AllDevice { id: string; name: string; mac: string; ip: string; is_online: boolean }
interface Room { id: string; name: string }
function DeviceChip({ device, onRemove }: { device: HierarchyDevice; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[var(--surface-3)] rounded text-sm">
      <Lightbulb size={12} className={device.is_online ? 'text-green-400' : 'text-muted-foreground'} />
      <span className="truncate">{device.name}</span>
      {onRemove && <button onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>}
    </div>
  )
}

function AddDeviceDialog({ open, onOpenChange, onAdd, allDevices, excludeIds, title }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (deviceId: string) => void; allDevices: AllDevice[]; excludeIds: Set<string>; title: string }) {
  const [search, setSearch] = useState('')
  const available = allDevices.filter((d) => !excludeIds.has(d.id) && (d.name.toLowerCase().includes(search.toLowerCase()) || d.mac.toLowerCase().includes(search.toLowerCase()) || d.ip.includes(search)))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Input placeholder="Search by name, MAC, or IP..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {available.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No available devices</p> : available.map((d) => (
            <button key={d.id} onClick={() => { onAdd(d.id); onOpenChange(false) }} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--surface-2)] text-left text-sm">
              <Lightbulb size={14} className={d.is_online ? 'text-green-400' : 'text-muted-foreground'} />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-xs text-muted-foreground">{d.ip}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreateDialog({ open, onOpenChange, type, rooms }: { open: boolean; onOpenChange: (o: boolean) => void; type: 'room' | 'zone' | 'group'; rooms: Room[] }) {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const queryClient = useQueryClient()
  const endpoint = type === 'room' ? '/rooms' : type === 'zone' ? '/zones' : '/groups'
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  const createMutation = useMutation({
    mutationFn: () => { const body: Record<string, unknown> = { name }; if (type === 'zone') body.room_id = roomId; return api.post(endpoint, body) },
    onSuccess: () => { toast.success(`${label} created`); queryClient.invalidateQueries({ queryKey: ['hierarchy'] }); queryClient.invalidateQueries({ queryKey: ['rooms'] }); queryClient.invalidateQueries({ queryKey: ['zones'] }); setName(''); setRoomId(''); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-sm">
        <DialogHeader><DialogTitle>Create {label}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${type === 'room' ? 'Living Room' : type === 'zone' ? 'TV Area' : 'Movie Lights'}`} autoFocus /></div>
          {type === 'zone' && (
            <div className="flex flex-col gap-2">
              <Label>Room</Label>
              <Select value={roomId} onValueChange={(v) => { if (v) setRoomId(v) }}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || (type === 'zone' && !roomId) || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : `Create ${label}`}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RoomsZonesPage() {
  const [createType, setCreateType] = useState<'room' | 'zone' | 'group' | null>(null)
  const [addDeviceTo, setAddDeviceTo] = useState<{ type: 'room' | 'zone' | 'group'; id: string; name: string } | null>(null)
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data: hierarchy } = useQuery<Hierarchy>({ queryKey: ['hierarchy'], queryFn: () => api.get('/devices/hierarchy') })
  const { data: allDevices = [] } = useQuery<AllDevice[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const { data: rooms = [] } = useQuery<Room[]>({ queryKey: ['rooms'], queryFn: () => api.get('/rooms') })
  const assignMutation = useMutation({ mutationFn: ({ deviceId, roomId, zoneId }: { deviceId: string; roomId: string | null; zoneId: string | null }) => api.post(`/devices/${deviceId}/assign`, { room_id: roomId, zone_id: zoneId }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hierarchy'] }); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const groupAddMutation = useMutation({ mutationFn: ({ groupId, deviceIds }: { groupId: string; deviceIds: string[] }) => api.put(`/groups/${groupId}`, { name: hierarchy?.groups.find((g) => g.id === groupId)?.name ?? '', device_ids: deviceIds }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hierarchy'] }) }, onError: (err: Error) => toast.error(err.message) })
  const deleteRoomMutation = useMutation({ mutationFn: (id: string) => api.delete(`/rooms/${id}`), onSuccess: () => { toast.success('Room deleted'); queryClient.invalidateQueries({ queryKey: ['hierarchy'] }); queryClient.invalidateQueries({ queryKey: ['rooms'] }) }, onError: (err: Error) => toast.error(err.message) })
  const deleteZoneMutation = useMutation({ mutationFn: (id: string) => api.delete(`/zones/${id}`), onSuccess: () => { toast.success('Zone deleted'); queryClient.invalidateQueries({ queryKey: ['hierarchy'] }) }, onError: (err: Error) => toast.error(err.message) })
  const deleteGroupMutation = useMutation({ mutationFn: (id: string) => api.delete(`/groups/${id}`), onSuccess: () => { toast.success('Group deleted'); queryClient.invalidateQueries({ queryKey: ['hierarchy'] }) }, onError: (err: Error) => toast.error(err.message) })
  const toggleRoom = (id: string) => { const next = new Set(expandedRooms); if (next.has(id)) next.delete(id); else next.add(id); setExpandedRooms(next) }
  const handleAddDevice = (deviceId: string) => {
    if (!addDeviceTo) return
    if (addDeviceTo.type === 'room') assignMutation.mutate({ deviceId, roomId: addDeviceTo.id, zoneId: null })
    else if (addDeviceTo.type === 'zone') { const room = hierarchy?.rooms.find((r) => r.zones.some((z) => z.id === addDeviceTo.id)); if (room) assignMutation.mutate({ deviceId, roomId: room.id, zoneId: addDeviceTo.id }) }
    else if (addDeviceTo.type === 'group') { const group = hierarchy?.groups.find((g) => g.id === addDeviceTo.id); if (group) groupAddMutation.mutate({ groupId: addDeviceTo.id, deviceIds: [...group.device_ids, deviceId] }) }
  }
  const removeFromRoom = (deviceId: string) => assignMutation.mutate({ deviceId, roomId: null, zoneId: null })
  const removeFromZone = (deviceId: string, roomId: string) => assignMutation.mutate({ deviceId, roomId, zoneId: null })
  const removeFromGroup = (groupId: string, deviceId: string) => { const group = hierarchy?.groups.find((g) => g.id === groupId); if (group) groupAddMutation.mutate({ groupId, deviceIds: group.device_ids.filter((id) => id !== deviceId) }) }
  const getDeviceById = (id: string) => allDevices.find((d) => d.id === id)
  const assignedInRoomOrZone = new Set<string>()
  hierarchy?.rooms.forEach((r) => { r.devices.forEach((d) => assignedInRoomOrZone.add(d.id)); r.zones.forEach((z) => z.devices.forEach((d) => assignedInRoomOrZone.add(d.id))) })
  const filterMatch = (name: string) => !search || name.toLowerCase().includes(search.toLowerCase())
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Rooms, Zones & Groups</h2>
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Tabs defaultValue="rooms">
        <TabsList><TabsTrigger value="rooms">Rooms & Zones</TabsTrigger><TabsTrigger value="groups">Groups</TabsTrigger></TabsList>
        <TabsContent value="rooms" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCreateType('room')}><Plus size={14} className="mr-1" />Add Room</Button>
            <Button size="sm" variant="outline" onClick={() => setCreateType('zone')}><Plus size={14} className="mr-1" />Add Zone</Button>
          </div>
          {hierarchy?.rooms.filter((r) => filterMatch(r.name) || r.zones.some((z) => filterMatch(z.name)) || r.devices.some((d) => filterMatch(d.name))).map((room) => {
            const isExpanded = expandedRooms.has(room.id)
            const totalDevices = room.devices.length + room.zones.reduce((acc, z) => acc + z.devices.length, 0)
            return (
              <Card key={room.id} className="bg-[var(--surface-1)] border-border">
                <CardContent className="p-0">
                  <button onClick={() => toggleRoom(room.id)} className="flex items-center gap-3 p-4 w-full text-left hover:bg-[var(--surface-2)] rounded-t-lg transition-colors">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <DoorOpen size={18} />
                    <span className="font-medium flex-1">{room.name}</span>
                    <span className="text-xs text-muted-foreground">{totalDevices} device(s), {room.zones.length} zone(s)</span>
                    <Button variant="ghost" size="icon" className="ml-2" onClick={(e) => { e.stopPropagation(); setAddDeviceTo({ type: 'room', id: room.id, name: room.name }) }}><Plus size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteRoomMutation.mutate(room.id) }}><Trash2 size={14} className="text-destructive" /></Button>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {room.zones.filter((z) => filterMatch(z.name) || z.devices.some((d) => filterMatch(d.name))).map((zone) => (
                        <div key={zone.id} className="pl-6 border-l-2 border-[var(--surface-3)]">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin size={14} />
                            <span className="text-sm font-medium">{zone.name}</span>
                            <span className="text-xs text-muted-foreground">{zone.devices.length} device(s)</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddDeviceTo({ type: 'zone', id: zone.id, name: zone.name })}><Plus size={12} /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteZoneMutation.mutate(zone.id)}><Trash2 size={12} className="text-destructive" /></Button>
                          </div>
                          <div className="flex flex-wrap gap-1">{zone.devices.filter((d) => filterMatch(d.name)).map((d) => <DeviceChip key={d.id} device={d} onRemove={() => removeFromZone(d.id, room.id)} />)}</div>
                        </div>
                      ))}
                      {room.devices.filter((d) => filterMatch(d.name)).length > 0 && (
                        <div className="pl-6 border-l-2 border-dashed border-[var(--surface-3)]">
                          <p className="text-xs text-muted-foreground mb-2">Unzoned</p>
                          <div className="flex flex-wrap gap-1">{room.devices.filter((d) => filterMatch(d.name)).map((d) => <DeviceChip key={d.id} device={d} onRemove={() => removeFromRoom(d.id)} />)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {hierarchy && hierarchy.unassigned.filter((d) => filterMatch(d.name)).length > 0 && (
            <Card className="bg-[var(--surface-1)] border-border border-dashed">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unassigned Devices</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-1">{hierarchy.unassigned.filter((d) => filterMatch(d.name)).map((d) => <DeviceChip key={d.id} device={d} />)}</div></CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="groups" className="space-y-3 mt-4">
          <Button size="sm" onClick={() => setCreateType('group')}><Plus size={14} className="mr-1" />Add Group</Button>
          {hierarchy?.groups.filter((g) => filterMatch(g.name)).map((group) => (
            <Card key={group.id} className="bg-[var(--surface-1)] border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={18} />
                  <span className="font-medium flex-1">{group.name}</span>
                  <span className="text-xs text-muted-foreground">{group.device_ids.length} device(s)</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddDeviceTo({ type: 'group', id: group.id, name: group.name })}><Plus size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGroupMutation.mutate(group.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.device_ids.map((did) => { const d = getDeviceById(did); return d ? <DeviceChip key={did} device={{ ...d, last_state: null }} onRemove={() => removeFromGroup(group.id, did)} /> : null })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      {createType && <CreateDialog open={true} onOpenChange={(open) => { if (!open) setCreateType(null) }} type={createType} rooms={rooms} />}
      {addDeviceTo && <AddDeviceDialog open={true} onOpenChange={(open) => { if (!open) setAddDeviceTo(null) }} onAdd={handleAddDevice} allDevices={allDevices} excludeIds={addDeviceTo.type === 'group' ? new Set(hierarchy?.groups.find((g) => g.id === addDeviceTo.id)?.device_ids ?? []) : assignedInRoomOrZone} title={`Add device to ${addDeviceTo.name}`} />}
    </div>
  )
}
