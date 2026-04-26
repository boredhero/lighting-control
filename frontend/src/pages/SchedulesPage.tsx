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
    <div className="space-y-4 3xl:space-y-6 tv:space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight">Schedules</h2>
        <Button onClick={() => setCreateOpen(true)} className="tv:h-12 tv:text-lg tv:px-6"><Plus className="size-4 tv:size-5 mr-2" />Create</Button>
      </div>
      {schedules.length === 0 ? (
        <p className="text-muted-foreground 3xl:text-lg">No schedules yet. Create one to automate your lighting.</p>
      ) : (
        <div className="flex flex-col gap-3 3xl:gap-4 tv:gap-6">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="bg-[var(--surface-1)] border-border">
              <CardContent className="flex items-center gap-3 3xl:gap-5 tv:gap-7 p-4 3xl:p-5 tv:p-7">
                <Clock className="size-5 3xl:size-6 tv:size-9 text-[var(--color-amber)] shrink-0" />
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{schedule.name}</p><p className="text-xs 3xl:text-sm text-muted-foreground">Priority {schedule.priority} &middot; {schedule.triggers.length} trigger(s) &middot; {schedule.targets.length} target(s)</p></div>
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
