import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'room' | 'zone' | 'group'
}

export function CreateOrgDialog({ open, onOpenChange, type }: Props) {
  const [name, setName] = useState('')
  const queryClient = useQueryClient()
  const endpoint = type === 'room' ? '/rooms' : type === 'zone' ? '/zones' : '/groups'
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => api.post(endpoint, data),
    onSuccess: () => { toast.success(`${label} created`); queryClient.invalidateQueries({ queryKey: [type === 'room' ? 'rooms' : type === 'zone' ? 'zones' : 'groups'] }); setName(''); onOpenChange(false) },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-border max-w-sm">
        <DialogHeader><DialogTitle>Create {label}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ name }) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${type === 'room' ? 'Living Room' : type === 'zone' ? 'Upstairs' : 'Movie Lights'}`} autoFocus /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : `Create ${label}`}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
