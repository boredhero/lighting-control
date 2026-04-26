import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Plus } from 'lucide-react'
import { CreateQuickActionDialog } from '@/components/CreateQuickActionDialog'

interface QuickAction { id: string; name: string; icon: string | null; sort_order: number; targets: unknown[] }

export function QuickActionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const { data: quickActions = [] } = useQuery<QuickAction[]>({ queryKey: ['quick-actions'], queryFn: () => api.get('/quick-actions') })
  return (
    <div className="space-y-4 3xl:space-y-6 tv:space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl 3xl:text-2xl tv:text-4xl font-semibold tracking-tight">Quick Actions</h2>
        <Button onClick={() => setCreateOpen(true)} className="tv:h-12 tv:text-lg tv:px-6"><Plus className="size-4 tv:size-5 mr-2" />Create</Button>
      </div>
      {quickActions.length === 0 ? (
        <p className="text-muted-foreground 3xl:text-lg">No quick actions yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6 tv:grid-cols-8 gap-3 3xl:gap-4 tv:gap-6">
          {quickActions.map((qa) => (
            <Card key={qa.id} className="bg-[var(--surface-1)] border-border">
              <CardContent className="flex items-center gap-3 3xl:gap-4 tv:gap-6 p-4 3xl:p-5 tv:p-7">
                <Zap className="size-5 3xl:size-6 tv:size-9 text-[var(--color-amber)] shrink-0" />
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{qa.name}</p><p className="text-xs 3xl:text-sm text-muted-foreground">{qa.targets.length} target(s)</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateQuickActionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
