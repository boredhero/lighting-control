import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Plus } from 'lucide-react'
import { CreateQuickActionDialog } from '@/components/CreateQuickActionDialog'
import { getDevicePalette } from '@/lib/devicePalette'
import { toast } from 'sonner'
import type { CSSProperties } from 'react'

interface QuickActionTarget { id: string; target_type: string; target_id: string | null; exclude_device_ids: string[] | null; state: Record<string, unknown> }
interface QuickAction { id: string; name: string; icon: string | null; sort_order: number; targets: QuickActionTarget[] }

function paletteForTargets(targets: QuickActionTarget[]) {
  const first = targets[0]
  if (!first) return null
  const s = first.state
  if (s.turn_off === true || s.state === false) return null
  return getDevicePalette({ is_online: true, last_state: s }, 'card')
}

export function QuickActionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { data: quickActions = [] } = useQuery<QuickAction[]>({ queryKey: ['quick-actions'], queryFn: () => api.get('/quick-actions') })
  const executeMutation = useMutation({
    mutationFn: (id: string) => api.post<{ executed: boolean; results: Record<string, boolean>; failures: { target_index: number; device_id?: string; error: string }[] }>(`/quick-actions/${id}/execute`),
    onMutate: (id: string) => { setPendingId(id) },
    onSettled: () => { setPendingId(null) },
    onSuccess: (data, id) => {
      const qa = quickActions.find((q) => q.id === id)
      const okCount = Object.values(data.results).filter(Boolean).length
      const failCount = Object.values(data.results).filter((v) => !v).length
      if (failCount === 0 && okCount > 0) toast.success(`${qa?.name ?? 'Quick action'} ran on ${okCount} device${okCount === 1 ? '' : 's'}`)
      else if (okCount === 0) toast.error(`${qa?.name ?? 'Quick action'} failed on all ${failCount} device${failCount === 1 ? '' : 's'}`)
      else toast.warning(`${qa?.name ?? 'Quick action'}: ${okCount} ok, ${failCount} failed`)
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <div className="space-y-4 3xl:space-y-6 tv:space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight">Quick Actions</h2>
        <Button onClick={() => setCreateOpen(true)} className="tv:h-12 tv:text-lg tv:px-6"><Plus className="size-4 tv:size-5 mr-2" />Create</Button>
      </div>
      {quickActions.length === 0 ? (
        <p className="text-muted-foreground 3xl:text-lg">No quick actions yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-5 tv:grid-cols-6 gap-3 3xl:gap-5 tv:gap-7 auto-rows-fr">
          {quickActions.map((qa, index) => {
            const palette = paletteForTargets(qa.targets)
            const isOff = palette === null
            const isPending = pendingId === qa.id
            const cardStyle: CSSProperties = {
              ['--card-glow' as never]: palette ? palette.iconBg : 'transparent',
              ...(palette && { backgroundColor: palette.bg, borderColor: palette.border }),
            }
            const iconStyle = palette ? { backgroundColor: palette.iconBg, color: palette.iconFg } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            const pillStyle = palette ? { backgroundColor: palette.pillBg, color: palette.pillText } : { backgroundColor: 'var(--surface-3)', color: 'var(--text-disabled)' }
            const targetLabel = qa.targets.length === 1 ? '1 target' : `${qa.targets.length} targets`
            return (
              <motion.div key={qa.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(index * 0.018, 0.35), ease: 'easeOut' }} className="h-full">
                <button type="button" onClick={() => executeMutation.mutate(qa.id)} disabled={isPending} className="block w-full h-full text-left disabled:opacity-60 disabled:cursor-wait">
                  <Card className={`h-full ${isOff ? 'bg-[var(--surface-1)] border-border' : 'border'} cursor-pointer hover:brightness-110 transition`} style={cardStyle}>
                    <CardContent className="flex flex-col h-full gap-3 3xl:gap-5 tv:gap-7 p-5 3xl:p-7 tv:p-10 min-h-[8.5rem] 3xl:min-h-[12rem] 4xl:min-h-[14rem] tv:min-h-[18rem]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="rounded-full p-2.5 3xl:p-3.5 tv:p-5 shrink-0" style={iconStyle}><Zap className="size-5 3xl:size-7 tv:size-12" /></div>
                        <span className="inline-flex h-5 3xl:h-7 tv:h-9 items-center rounded-full px-2 3xl:px-3 tv:px-4 text-xs 3xl:text-sm tv:text-base font-medium shrink-0" style={pillStyle}>{isPending ? 'Running...' : targetLabel}</span>
                      </div>
                      <div className="flex-1 flex flex-col justify-end min-w-0">
                        <p className="font-semibold text-base 3xl:text-xl tv:text-3xl leading-tight tracking-tight break-words line-clamp-2">{qa.name}</p>
                        <p className="text-xs 3xl:text-sm tv:text-lg mt-1.5 3xl:mt-2 tv:mt-3 truncate" style={{ color: palette ? palette.iconFg : 'var(--text-secondary)', opacity: palette ? 0.85 : 1 }}>Tap to run</p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
      <CreateQuickActionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
