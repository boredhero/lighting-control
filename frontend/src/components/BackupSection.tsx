import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Upload, Archive, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BackupEnvelope {
  version: number
  exported_at: string
  app_version: string | null
  data: { devices: unknown[]; hierarchy: { rooms: unknown[]; groups: unknown[] }; schedules: unknown[]; quick_actions: unknown[]; scenes: unknown[] }
}

interface RestoreResponse {
  devices_updated: number
  rooms: { remapped: number }
  schedules: { created: number; updated: number }
  quick_actions: { created: number; updated: number }
  scenes: { created: number; updated: number }
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}::${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function BackupSection() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const exportMutation = useMutation({
    mutationFn: () => api.get<BackupEnvelope>('/backup/export'),
    onSuccess: (envelope) => {
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lighting_backup-${formatTimestamp(new Date())}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const importMutation = useMutation({
    mutationFn: async (envelope: BackupEnvelope) => {
      return api.post<RestoreResponse>('/backup/import', { version: envelope.version, data: envelope.data, mode })
    },
    onSuccess: (result) => {
      const r = result as RestoreResponse
      toast.success(`Restored: ${r.schedules.created + r.schedules.updated} schedules, ${r.quick_actions.created + r.quick_actions.updated} quick actions, ${r.scenes.created + r.scenes.updated} scenes`)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      queryClient.invalidateQueries()
    },
    onError: (err: Error) => toast.error(`Restore failed: ${err.message}`),
  })
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }
  const beginRestore = () => {
    if (!selectedFile) return
    if (mode === 'replace') { setConfirmOpen(true); return }
    runRestore()
  }
  const runRestore = () => {
    if (!selectedFile) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const envelope = JSON.parse(reader.result as string) as BackupEnvelope
        if (typeof envelope.version !== 'number' || !envelope.data) { toast.error('Invalid backup file'); return }
        importMutation.mutate(envelope)
      } catch {
        toast.error('Could not parse backup file')
      }
    }
    reader.readAsText(selectedFile)
    setConfirmOpen(false)
  }
  return (
    <>
      <Card className="bg-[var(--surface-1)] border-border">
        <CardHeader><CardTitle className="flex items-center gap-2"><Archive size={18} />Backup & Restore</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Download a single JSON file containing your devices, rooms, zones, groups, schedules, quick actions, and custom scenes. Use it to restore later or migrate to a new install. Auth and per-user secrets are not included.</p>
          <div>
            <h3 className="text-sm font-medium mb-2">Backup</h3>
            <Button variant="outline" size="sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}><Download size={14} className="mr-2" />{exportMutation.isPending ? 'Preparing...' : 'Download backup.json'}</Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Restore</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} className="mr-2" />{selectedFile ? selectedFile.name : 'Choose file...'}</Button>
              <Select value={mode} onValueChange={(v) => setMode(v as 'merge' | 'replace')}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge</SelectItem>
                  <SelectItem value="replace">Replace</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={beginRestore} disabled={!selectedFile || importMutation.isPending}>{importMutation.isPending ? 'Restoring...' : 'Restore'}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{mode === 'merge' ? 'Merge: adds new items, updates existing items by ID/name. Never deletes.' : 'Replace: deletes all existing schedules, quick actions, scenes, rooms, zones, and groups before importing. Devices are preserved (physical hardware).'}</p>
          </div>
        </CardContent>
      </Card>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[var(--surface-1)] border-border max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={18} />Confirm destructive restore</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>You're about to <strong>replace</strong> all of the following with the contents of <code className="font-mono text-xs">{selectedFile?.name}</code>:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>All schedules (and their triggers/targets)</li>
              <li>All quick actions</li>
              <li>All custom scenes</li>
              <li>All rooms, zones, and groups</li>
            </ul>
            <p className="text-muted-foreground">Devices themselves (physical bulbs) are not deleted — only their names and assignments will be updated to match the backup.</p>
            <p className="font-medium text-destructive">This cannot be undone except by restoring a previous backup.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={runRestore}>Replace everything</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
