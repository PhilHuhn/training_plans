'use client'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatElapsed } from '@/lib/import-progress'

interface StageProgressProps<S extends string> {
  /** Stages in wall-clock order. */
  order: readonly S[]
  /** The stage currently running. */
  active: S
  /** The line to show for each stage, already formatted with any live counts. */
  label: (stage: S) => string
  /** Seconds since the operation started. */
  elapsed: number
  /** Closing note under the list — the reason to keep the window open. */
  note?: string
}

/**
 * A checklist that advances as a long server operation reports its stages:
 * done stages carry a tick, the running one a spinner, the rest sit greyed.
 *
 * Shared by plan generation and plan import so the two long AI operations in
 * the app read identically, and so the wait always shows *which part* is slow
 * rather than an undifferentiated spinner.
 */
export default function StageProgress<S extends string>({
  order,
  active,
  label,
  elapsed,
  note,
}: StageProgressProps<S>) {
  const activeIndex = order.indexOf(active)
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2.5">
        {order.map((stage, i) => {
          const done = i < activeIndex
          const running = i === activeIndex
          return (
            <div
              key={stage}
              className={cn(
                'flex items-center gap-2.5 text-sm transition-colors',
                done && 'text-muted-foreground',
                running && 'text-foreground',
                !done && !running && 'text-muted-foreground/40',
              )}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current" />
                )}
              </span>
              <span className={cn(running && 'italic')}>{label(stage)}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatElapsed(elapsed)} elapsed{note ? ` · ${note}` : ''}
      </p>
    </div>
  )
}
