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
  const executeMutation = useMutation({ mutationFn: (id: string) => api.post(`/quick-actions/${id}/execute`), onSuccess: () => { toast.success('Quick action executed'); queryClient.invalidateQueries({ queryKey: ['devices'] }) }, onError: (err: Error) => toast.error(err.message) })
  const onlineCount = devices.filter((d) => d.is_online).length
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2"><Lightbulb size={20} className="text-[var(--color-amber)]" /><span className="text-lg font-semibold">{onlineCount} online</span><span className="text-muted-foreground">/ {devices.length} devices</span></div>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Zap size={20} />Quick Actions</h2>
        {quickActions.length === 0 ? (
          <p className="text-muted-foreground">No quick actions yet. Create one from the Quick Actions page.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {quickActions.map((qa) => (
              <Card key={qa.id} className="bg-[var(--surface-1)] border-border cursor-pointer hover:bg-[var(--surface-2)] transition-colors active:bg-[var(--surface-3)]" onClick={() => executeMutation.mutate(qa.id)}>
                <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                  <Zap size={24} className="text-[var(--color-amber)]" />
                  <span className="text-sm font-medium text-center">{qa.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
