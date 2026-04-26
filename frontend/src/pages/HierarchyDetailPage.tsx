import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LightingStateControl, type StateValue } from '@/components/LightingStateControl'
import { Power, Home, Layers, Users, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export type HierarchyKind = 'room' | 'zone' | 'group'

interface Entity { id: string; name: string; icon: string | null }
interface Device { id: string; name: string; ip: string; is_online: boolean; last_state: Record<string, unknown> | null }
interface BulkResult { success_count: number; failure_count: number; failures: { device_id: string; error: string }[] }

const KIND_CONFIG: Record<HierarchyKind, { listPath: string; deviceParam: string; targetType: string; label: string; icon: typeof Home }> = {
  room: { listPath: '/rooms', deviceParam: 'room_id', targetType: 'room', label: 'Room', icon: Home },
  zone: { listPath: '/zones', deviceParam: 'zone_id', targetType: 'zone', label: 'Zone', icon: Layers },
  group: { listPath: '/groups', deviceParam: 'group_id', targetType: 'group', label: 'Group', icon: Users },
}

function reportBulk(result: BulkResult, label: string) {
  if (result.failure_count === 0) return
  if (result.success_count === 0) toast.error(`${label}: all ${result.failure_count} devices failed`)
  else toast.warning(`${label}: ${result.success_count} updated, ${result.failure_count} failed`)
}

export function HierarchyDetailPage({ kind }: { kind: HierarchyKind }) {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const cfg = KIND_CONFIG[kind]
  const Icon = cfg.icon
  const { data: entities } = useQuery<Entity[]>({ queryKey: [`${kind}s`], queryFn: () => api.get(cfg.listPath) })
  const { data: devices } = useQuery<Device[]>({ queryKey: ['devices', cfg.deviceParam, id], queryFn: () => api.get(`/devices?${cfg.deviceParam}=${id}`) })
  const [stateValue, setStateValue] = useState<StateValue>({})
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bulkMutation = useMutation({
    mutationFn: (state: StateValue) => api.post<BulkResult>('/devices/bulk-control', { target_type: cfg.targetType, target_id: id, state }),
    onSuccess: (res) => { reportBulk(res as BulkResult, entity?.name ?? cfg.label); queryClient.invalidateQueries({ queryKey: ['devices'] }) },
    onError: (err: Error) => toast.error(err.message),
  })
  const deviceMutation = useMutation({
    mutationFn: ({ deviceId, state }: { deviceId: string; state: StateValue }) => api.post<{ success: boolean }>(`/devices/${deviceId}/control`, { state }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
    onError: (err: Error) => toast.error(err.message),
  })
  const entity = entities?.find((e) => e.id === id)
  const memberDevices = devices ?? []
  const anyOn = memberDevices.some((d) => d.last_state?.state !== false && d.is_online)
  const handleStateChange = (next: StateValue) => {
    setStateValue(next)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => bulkMutation.mutate(next), 300)
  }
  const handleMasterToggle = () => {
    const next: StateValue = anyOn ? { turn_off: true } : { dimming: typeof stateValue.dimming === 'number' ? stateValue.dimming : 100 }
    setStateValue(next)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    bulkMutation.mutate(next)
  }
  const handleDeviceToggle = (d: Device) => {
    const isOn = d.last_state?.state !== false
    const next: StateValue = isOn ? { turn_off: true } : { dimming: 100 }
    deviceMutation.mutate({ deviceId: d.id, state: next })
  }
  if (!entity) return <p className="text-muted-foreground">Loading {cfg.label.toLowerCase()}...</p>
  const onlineCount = memberDevices.filter((d) => d.is_online).length
  return (
    <div className="space-y-6 3xl:space-y-8 tv:space-y-12 max-w-2xl 3xl:max-w-4xl tv:max-w-6xl mx-auto" data-testid="hierarchy-detail-page" data-kind={kind}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 3xl:gap-5 tv:gap-7 min-w-0">
          <div className="rounded-full p-3 3xl:p-4 tv:p-6 shrink-0 bg-[var(--surface-3)] text-foreground"><Icon className="size-7 3xl:size-9 tv:size-14" /></div>
          <div className="min-w-0">
            <h2 className="text-2xl 3xl:text-3xl tv:text-4xl font-bold truncate">{entity.name}</h2>
            <p className="text-muted-foreground 3xl:text-lg tv:text-xl">{cfg.label} · {memberDevices.length} {memberDevices.length === 1 ? 'device' : 'devices'} · {onlineCount} online</p>
          </div>
        </div>
        <Button variant={anyOn ? 'default' : 'outline'} size="icon" className="tv:size-14 shrink-0" onClick={handleMasterToggle} data-testid="hierarchy-master-toggle"><Power className="size-5 tv:size-7" /></Button>
      </div>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardContent className="p-4 3xl:p-6 tv:p-9">
          <LightingStateControl value={stateValue} onChange={handleStateChange} size="full" />
        </CardContent>
      </Card>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader className="3xl:px-6 tv:px-9"><CardTitle className="3xl:text-lg tv:text-2xl">Members</CardTitle></CardHeader>
        <CardContent className="3xl:px-6 tv:px-9 3xl:pb-3 tv:pb-5">
          {memberDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="hierarchy-no-members">No devices yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {memberDevices.map((d) => {
                const isOn = d.last_state?.state !== false && d.is_online
                const dimming = typeof d.last_state?.dimming === 'number' ? (d.last_state.dimming as number) : null
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 3xl:py-3">
                    <Link to={`/devices/${d.id}`} className="flex items-center gap-2 3xl:gap-3 min-w-0 hover:opacity-80">
                      <Lightbulb className="size-4 3xl:size-5 text-muted-foreground shrink-0" />
                      <span className="text-sm 3xl:text-base tv:text-lg truncate">{d.name}</span>
                    </Link>
                    <div className="flex items-center gap-2 3xl:gap-3 shrink-0">
                      {!d.is_online && <Badge variant="secondary" className="text-[10px]">Offline</Badge>}
                      {d.is_online && dimming !== null && <span className="text-xs 3xl:text-sm text-muted-foreground tabular-nums">{dimming}%</span>}
                      <Button variant={isOn ? 'default' : 'outline'} size="icon" className="size-8 3xl:size-9" onClick={() => handleDeviceToggle(d)} disabled={!d.is_online} data-testid={`device-toggle-${d.id}`}><Power className="size-3 3xl:size-4" /></Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
