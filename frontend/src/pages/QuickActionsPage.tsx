import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Zap, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { QuickActionDialog } from '@/components/QuickActionDialog'
import { getStatePalette } from '@/lib/devicePalette'
import { toast } from 'sonner'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { TargetConfig } from '@/components/TargetSelector'

interface QuickActionTarget extends TargetConfig { id: string }
interface QuickAction { id: string; name: string; icon: string | null; sort_order: number; targets: QuickActionTarget[] }

function paletteForTargets(targets: QuickActionTarget[]) {
  return getStatePalette(targets[0]?.state, 'card')
}

export function QuickActionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingQa, setEditingQa] = useState<QuickAction | null>(null)
  const [deletingQa, setDeletingQa] = useState<QuickAction | null>(null)
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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quick-actions/${id}`),
    onSuccess: () => { toast.success('Quick action deleted'); queryClient.invalidateQueries({ queryKey: ['quick-actions'] }); setDeletingQa(null) },
    onError: (err: Error) => toast.error(err.message),
  })
  const onCardKey = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); executeMutation.mutate(id) }
  }
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
            const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
            return (
              <motion.div key={qa.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(index * 0.018, 0.35), ease: 'easeOut' }} className="h-full">
                <div role="button" tabIndex={0} aria-label={`Run ${qa.name}`} aria-busy={isPending} onClick={() => executeMutation.mutate(qa.id)} onKeyDown={(e) => onCardKey(e, qa.id)} className={`h-full block outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber)] rounded-2xl ${isPending ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                  <Card className={`h-full ${isOff ? 'bg-[var(--surface-1)] border-border' : 'border'} hover:brightness-110 transition`} style={cardStyle}>
                    <CardContent className="flex flex-col h-full gap-3 3xl:gap-5 tv:gap-7 p-5 3xl:p-7 tv:p-10 min-h-[8.5rem] 3xl:min-h-[12rem] 4xl:min-h-[14rem] tv:min-h-[18rem]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="rounded-full p-2.5 3xl:p-3.5 tv:p-5 shrink-0" style={iconStyle}><Zap className="size-5 3xl:size-7 tv:size-12" /></div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 3xl:h-7 tv:h-9 items-center rounded-full px-2 3xl:px-3 tv:px-4 text-xs 3xl:text-sm tv:text-base font-medium shrink-0" style={pillStyle}>{isPending ? 'Running...' : targetLabel}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<button type="button" aria-label="Quick action options" onClick={stop} onPointerDown={stop} onKeyDown={stop} className="rounded-full p-1.5 hover:bg-black/20 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber)]" style={{ color: palette ? palette.pillText : 'var(--text-secondary)' }} />}>
                              <MoreVertical className="size-4 3xl:size-5 tv:size-7" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { stop(e); setEditingQa(qa) }}><Pencil className="size-4 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { stop(e); setDeletingQa(qa) }} className="text-[var(--color-error)] focus:text-[var(--color-error)]"><Trash2 className="size-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-end min-w-0">
                        <p className="font-semibold text-base 3xl:text-xl tv:text-3xl leading-tight tracking-tight break-words line-clamp-2">{qa.name}</p>
                        <p className="text-xs 3xl:text-sm tv:text-lg mt-1.5 3xl:mt-2 tv:mt-3 truncate" style={{ color: palette ? palette.iconFg : 'var(--text-secondary)', opacity: palette ? 0.85 : 1 }}>Tap to run</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
      <QuickActionDialog open={createOpen} onOpenChange={setCreateOpen} />
      <QuickActionDialog open={!!editingQa} onOpenChange={(o) => { if (!o) setEditingQa(null) }} quickAction={editingQa} />
      <Dialog open={!!deletingQa} onOpenChange={(o) => { if (!o) setDeletingQa(null) }}>
        <DialogContent className="bg-[var(--surface-1)] border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete "{deletingQa?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This can't be undone. Devices won't be affected — only the saved quick action is removed.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeletingQa(null)}>Cancel</Button>
            <Button onClick={() => deletingQa && deleteMutation.mutate(deletingQa.id)} disabled={deleteMutation.isPending} className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-white">{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
