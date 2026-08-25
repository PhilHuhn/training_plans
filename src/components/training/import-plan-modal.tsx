'use client'
import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import StageProgress from '@/components/training/stage-progress'
import { useUploadPlan } from '@/hooks/use-training'
import { useCurrentUser } from '@/hooks/use-auth'
import { cn, formatDateShort } from '@/lib/utils'
import {
  IMPORT_STAGE_ORDER,
  formatBytes,
  importStageLabel,
  type ImportProgress,
} from '@/lib/import-progress'

// Matches the server allowlist in api/training/upload-plan/route.ts. `.doc` is
// accepted there and used to be missing here, which silently blocked a format
// the backend handles.
const ACCEPT = '.pdf,.docx,.doc,.txt,.md'
const MAX_BYTES = 10 * 1024 * 1024

interface ImportPlanModalProps {
  open: boolean
  onClose: () => void
  /** Anchors an undated plan to the visible range rather than next Monday. */
  startDate?: string
}

/**
 * Imports a training plan document.
 *
 * Lives on the training page rather than in Settings, where it used to be the
 * last card of one tab of a very long page. The staged readout matters here:
 * the parse is a model call that can run for minutes, and the old UI showed a
 * static "Parsing..." badge for the whole of it.
 */
export default function ImportPlanModal({ open, onClose, startDate }: ImportPlanModalProps) {
  const { data: user } = useCurrentUser()
  const aiDisabled = user?.ai_enabled === false
  const upload = useUploadPlan()

  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<ImportProgress>({ stage: 'uploading' })
  const [elapsed, setElapsed] = useState(0)

  const busy = upload.isPending

  // Reset whenever the dialog is reopened, so a previous run's file and stage
  // do not greet the next one.
  useEffect(() => {
    if (!open) return
    setFile(null)
    setDragging(false)
    setProgress({ stage: 'uploading' })
    setElapsed(0)
  }, [open])

  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [busy])

  const chooseFile = (candidate: File | undefined) => {
    if (!candidate) return
    if (candidate.size > MAX_BYTES) {
      toast.error(`That file is ${formatBytes(candidate.size)} — the limit is 10 MB.`)
      return
    }
    setFile(candidate)
  }

  const start = () => {
    if (!file) return
    setProgress({ stage: 'uploading', filename: file.name, size: file.size })
    upload.mutate(
      {
        file,
        start_date: startDate,
        onProgress: (event) => {
          if (event.type !== 'status') return
          // Carry the previous counts forward: a stage frame reports only what
          // it knows, so the session tally must not blink back to zero.
          setProgress((prev) => ({ ...prev, ...event }))
        },
      },
      {
        onSuccess: (plan) => {
          toast.success(
            `Imported ${plan.parsed_sessions_count} sessions from ${plan.filename}`,
          )
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to import the plan')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Training Plan
          </DialogTitle>
          <DialogDescription>
            {busy
              ? 'Reading your plan — this runs through several phases.'
              : 'Upload a PDF, Word, text or Markdown file. Sessions are read out of it and placed on your calendar.'}
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <StageProgress
            order={IMPORT_STAGE_ORDER}
            active={progress.stage}
            label={(stage) => importStageLabel(stage, progress)}
            elapsed={elapsed}
            note="a long plan can take a few minutes — please keep this window open."
          />
        ) : (
          <div className="space-y-3">
            {aiDisabled && (
              <p className="border-l-2 border-foreground/25 py-1 pl-3 text-sm italic text-muted-foreground">
                {user?.ai_disabled_notice}
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                chooseFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {file ? (
              <div className="flex items-center gap-3 border border-foreground/25 px-3.5 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                  className="text-muted-foreground hover:text-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={aiDisabled}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!aiDisabled) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (!aiDisabled) chooseFile(e.dataTransfer.files?.[0])
                }}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 border border-dashed px-4 py-8 transition-colors',
                  dragging
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-foreground/30 text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                  aiDisabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Drop a plan here, or click to choose</span>
                <span className="text-xs text-muted-foreground">
                  PDF, Word, TXT or Markdown · up to 10 MB
                </span>
              </button>
            )}

            {/* The anchor is the block you are looking at, not always next
                Monday — worth saying, since a plan written as "Week 1, Week 2"
                has no dates of its own to go on. */}
            {startDate && (
              <p className="text-xs text-muted-foreground">
                A plan without its own dates will start from{' '}
                <span className="tabular-nums">{formatDateShort(startDate)}</span>.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={start} disabled={!file || busy || aiDisabled}>
            {busy ? 'Importing…' : 'Import plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
