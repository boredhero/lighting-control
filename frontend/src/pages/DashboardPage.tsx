import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Lightbulb, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface Device { id: string; name: string; is_online: boolean }
interface QuickAction { id: string; name: string; icon: string | null; sort_order: number }

export function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ['devices'], queryFn: () => api.get('/devices') })
  const { data: quickActions = [] } = useQuery<QuickAction[]>({ queryKey: ['quick-actions'], queryFn: () => api.get('/quick-actions') })
  const executeMutation = useMutation({ mutationFn: (id: string) => api.post<{ results: Record<string, boolean> }>(`/quick-actions/${id}/execute`), onSuccess: (data) => { const d = data as { results: Record<string, boolean> }; const failed = Object.values(d.results).filter((v) => !v).length; if (failed > 0) { toast.error(`${failed} device(s) did not respond`) } else { toast.success('Quick action executed') }; queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const onlineCount = devices.filter((d) => d.is_online).length
  return (
    <div className="space-y-6 3xl:space-y-8 tv:space-y-12">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 3xl:gap-3"><Lightbulb className="size-5 3xl:size-6 tv:size-8 text-[var(--color-amber)]" /><span className="text-lg 3xl:text-xl tv:text-3xl font-semibold">{onlineCount} online</span><span className="text-muted-foreground 3xl:text-lg tv:text-2xl">/ {devices.length} devices</span></div>
      </div>
      <div>
        <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight mb-4 3xl:mb-6 tv:mb-8 flex items-center gap-2 3xl:gap-3"><Zap className="size-5 3xl:size-6 tv:size-8" />Quick Actions</h2>
        {quickActions.length === 0 ? (
          <p className="text-muted-foreground">No quick actions yet. Create one from the Quick Actions page.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 tv:grid-cols-10 gap-3 3xl:gap-4 tv:gap-6">
            {quickActions.map((qa) => (
              <Card key={qa.id} className="bg-[var(--surface-1)] border-border cursor-pointer hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]" onClick={() => executeMutation.mutate(qa.id)}>
                <CardContent className="flex flex-col items-center justify-center p-4 3xl:p-6 tv:p-9 gap-2 3xl:gap-3 tv:gap-4">
                  <Zap className="size-6 3xl:size-8 tv:size-12 text-[var(--color-amber)]" />
                  <span className="text-sm 3xl:text-base tv:text-xl font-medium text-center">{qa.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
