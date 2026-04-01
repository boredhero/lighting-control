import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Plus } from 'lucide-react'

interface QuickAction { id: string; name: string; icon: string | null; sort_order: number; targets: unknown[] }

export function QuickActionsPage() {
  const { data: quickActions = [] } = useQuery<QuickAction[]>({ queryKey: ['quick-actions'], queryFn: () => api.get('/quick-actions') })
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <Button><Plus size={16} className="mr-2" />Create</Button>
      </div>
      {quickActions.length === 0 ? (
        <p className="text-muted-foreground">No quick actions yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {quickActions.map((qa) => (
            <Card key={qa.id} className="bg-[var(--surface-1)] border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <Zap size={20} className="text-[var(--color-amber)]" />
                <div className="flex-1"><p className="font-medium">{qa.name}</p><p className="text-xs text-muted-foreground">{qa.targets.length} target(s)</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
