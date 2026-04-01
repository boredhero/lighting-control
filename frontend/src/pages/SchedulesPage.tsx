import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Clock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CreateScheduleDialog } from '@/components/CreateScheduleDialog'

interface Schedule { id: string; name: string; enabled: boolean; priority: number; triggers: unknown[]; targets: unknown[] }

export function SchedulesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: schedules = [] } = useQuery<Schedule[]>({ queryKey: ['schedules'], queryFn: () => api.get('/schedules') })
  const toggleMutation = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.post(`/schedules/${id}/${enabled ? 'enable' : 'disable'}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }), onError: (err: Error) => toast.error(err.message) })
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schedules</h2>
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} className="mr-2" />Create</Button>
      </div>
      {schedules.length === 0 ? (
        <p className="text-muted-foreground">No schedules yet. Create one to automate your lighting.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="bg-[var(--surface-1)] border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <Clock size={20} className="text-[var(--color-amber)]" />
                <div className="flex-1"><p className="font-medium">{schedule.name}</p><p className="text-xs text-muted-foreground">Priority {schedule.priority} &middot; {schedule.triggers.length} trigger(s) &middot; {schedule.targets.length} target(s)</p></div>
                <Switch checked={schedule.enabled} onCheckedChange={(checked) => toggleMutation.mutate({ id: schedule.id, enabled: checked })} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
