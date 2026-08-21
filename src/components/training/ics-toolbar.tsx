'use client'
import { useRef, useState } from 'react'
import { CalendarArrowDown, CalendarArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { trainingApi } from '@/api/training'

/**
 * .ics import/export controls for the training toolbar. Export downloads the
 * caller's own sessions in the visible range; import creates planned sessions
 * from an uploaded calendar (dedup handled server-side).
 */
export default function IcsToolbar({ start, end }: { start?: string; end?: string }) {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const doExport = async () => {
    try {
      setBusy(true)
      const res = await trainingApi.exportIcs(start, end)
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `training_${start ?? 'all'}_${end ?? 'all'}.ics`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File) => {
    try {
      setBusy(true)
      const { data } = await trainingApi.importIcs(file)
      const bits = [`${data.imported} importiert`]
      if (data.duplicates) bits.push(`${data.duplicates} Duplikate übersprungen`)
      if (data.skipped.length) bits.push(`${data.skipped.length} ignoriert`)
      toast.success(bits.join(' · '))
      queryClient.invalidateQueries({ queryKey: ['trainingRange'] })
      queryClient.invalidateQueries({ queryKey: ['trainingWeek'] })
    } catch {
      toast.error('Import fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) doImport(file)
          e.target.value = ''
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
        <CalendarArrowDown className="mr-1.5 h-3.5 w-3.5" />
        Import .ics
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={doExport}>
        <CalendarArrowUp className="mr-1.5 h-3.5 w-3.5" />
        Export .ics
      </Button>
    </>
  )
}
