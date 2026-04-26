import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lightbulb, Radar } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getDevicePalette, getDeviceBrightness } from '@/lib/devicePalette'
import type { CSSProperties } from 'react'

interface Device { id: string; name: string; mac: string; ip: string; is_online: boolean; bulb_type: string | null; room_id: string | null; last_state: Record<string, unknown> | null }

export function DevicesPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const discoverMutation = useMutation({ mutationFn: () => api.post<{ discovered: number }>('/devices/discover'), onSuccess: (data) => { toast.success(`Discovery complete: ${(data as { discovered: number }).discovered} device(s) found`); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const filtered = devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.mac.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-4 3xl:space-y-6 tv:space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight">Devices</h2>
        <div className="flex items-center gap-2 3xl:gap-3">
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs 3xl:max-w-sm tv:max-w-md tv:h-12 tv:text-lg" />
          <Button variant="outline" onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending} className="tv:h-12 tv:text-lg tv:px-6"><Radar className="size-4 3xl:size-5 tv:size-6 mr-2" />{discoverMutation.isPending ? 'Scanning...' : 'Scan Network'}</Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading devices...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 3xl:py-16 tv:py-24">
          <Lightbulb className="size-12 3xl:size-16 tv:size-24 mx-auto text-muted-foreground mb-4 3xl:mb-6" />
          <p className="text-muted-foreground mb-4 3xl:text-lg tv:text-xl">No devices found. Make sure your WiZ devices are on the same network.</p>
          <Button onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending} className="tv:h-12 tv:text-lg tv:px-6"><Radar className="size-4 3xl:size-5 tv:size-6 mr-2" />{discoverMutation.isPending ? 'Scanning...' : 'Scan Network'}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 tv:grid-cols-6 gap-3 3xl:gap-5 tv:gap-7 auto-rows-fr">
          {filtered.map((device, index) => {
            const palette = getDevicePalette(device, 'card')
            const brightness = getDeviceBrightness(device)
            const isOff = palette === null
            const cardStyle: CSSProperties = {
              ['--card-glow' as never]: palette ? palette.iconBg : 'transparent',
              ...(palette && { backgroundColor: palette.bg, borderColor: palette.border }),
            }
            const iconStyle = palette ? { backgroundColor: palette.iconBg, color: palette.iconFg } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            const pillStyle = palette ? { backgroundColor: palette.pillBg, color: palette.pillText } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            return (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.018, 0.35), ease: 'easeOut' }}
                className="h-full"
              >
                <Link to={`/devices/${device.id}`} className="block h-full">
                  <Card className={`h-full ${isOff ? 'bg-[var(--surface-1)] border-border cursor-pointer' : 'border cursor-pointer'}`} style={cardStyle}>
                    <CardContent className="flex flex-col h-full gap-3 3xl:gap-5 tv:gap-7 p-5 3xl:p-7 tv:p-10 min-h-[8.5rem] 3xl:min-h-[12rem] 4xl:min-h-[14rem] tv:min-h-[18rem]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="rounded-full p-2.5 3xl:p-3.5 tv:p-5 shrink-0" style={iconStyle}><Lightbulb className="size-5 3xl:size-7 tv:size-12" /></div>
                        <span className="inline-flex h-5 3xl:h-7 tv:h-9 items-center rounded-full px-2 3xl:px-3 tv:px-4 text-xs 3xl:text-sm tv:text-base font-medium shrink-0" style={pillStyle}>{isOff ? 'Off' : 'Online'}</span>
                      </div>
                      <div className="flex-1 flex flex-col justify-end min-w-0">
                        <p className="font-semibold text-base 3xl:text-xl tv:text-3xl leading-tight tracking-tight break-words line-clamp-2">{device.name}</p>
                        <p className="text-xs 3xl:text-sm tv:text-lg mt-1.5 3xl:mt-2 tv:mt-3 truncate" style={{ color: palette ? palette.iconFg : 'var(--text-secondary)', opacity: palette ? 0.85 : 1 }}>{device.ip}{brightness !== null ? ` · ${brightness}%` : ''}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
