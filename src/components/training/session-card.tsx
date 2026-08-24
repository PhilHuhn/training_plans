'use client'
import { useState } from 'react'
import { Check, Pencil, Download, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, workoutTypeColor, formatDistanceKm, phaseColor, rpeColor, formatPace } from '@/lib/utils'
import { planningSportTheme } from '@/lib/sport-theme'
import type { WorkoutDetails, TrainingSession } from '@/lib/types'
import { trainingApi } from '@/api/training'
import { useUpdateSession } from '@/hooks/use-training'

interface SessionCardProps {
  workout?: WorkoutDetails
  variant: 'planned' | 'ai' | 'final'
  session: TrainingSession
  onEdit?: () => void
  onAccept?: () => void
  onSwapAlternative?: () => void
}

function ComparisonOverlay({
  planned,
  actual,
}: {
  planned: WorkoutDetails
  actual: NonNullable<TrainingSession['completed_activity_summary']>
}) {
  const [open, setOpen] = useState(false)

  const rows: { label: string; plan: string; act: string; pct?: number }[] = []

  if (planned.distance_km && actual.distance_km) {
    const pct = Math.round((actual.distance_km / planned.distance_km) * 100)
    rows.push({
      label: 'Distance',
      plan: `${planned.distance_km.toFixed(1)} km`,
      act: `${actual.distance_km.toFixed(1)} km`,
      pct,
    })
  }
  if (planned.duration_min && actual.duration_min) {
    const pct = Math.round((actual.duration_min / planned.duration_min) * 100)
    rows.push({
      label: 'Duration',
      plan: `${planned.duration_min} min`,
      act: `${Math.round(actual.duration_min)} min`,
      pct,
    })
  }
  if (planned.hr_zone && actual.avg_hr) {
    rows.push({
      label: 'HR',
      plan: planned.hr_zone,
      act: `${actual.avg_hr} bpm`,
    })
  }
  if (planned.pace_range && actual.avg_pace) {
    rows.push({
      label: 'Pace',
      plan: planned.pace_range,
      act: formatPace(actual.avg_pace),
    })
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-2 border-t border-foreground/15 pt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Planned vs Actual
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-[10px]">
              <span className="w-14 text-muted-foreground">{r.label}</span>
              <span className="w-16 text-right">{r.plan}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="w-16">{r.act}</span>
              {r.pct !== undefined && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-1 py-0',
                    r.pct >= 90 && r.pct <= 110
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-amber-500 text-amber-700',
                  )}
                >
                  {r.pct}%
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RpeInput({
  value,
  onChange,
}: {
  value?: number
  onChange: (rpe: number) => void
}) {
  return (
    <div className="mt-2 border-t border-foreground/15 pt-1">
      <p className="mb-1 text-[10px] text-muted-foreground">How did it feel? (RPE)</p>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-none border border-foreground/30 text-[10px] transition-colors',
              value === n
                ? 'border-foreground bg-foreground/10 italic'
                : 'bg-transparent hover:bg-foreground/5',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SessionCard({
  workout,
  variant,
  session,
  onEdit,
  onAccept,
  onSwapAlternative,
}: SessionCardProps) {
  const updateSession = useUpdateSession()

  if (!workout) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[80px] items-center justify-center rounded-none border border-dashed border-foreground/30 p-3 text-xs italic text-muted-foreground',
        )}
      >
        {variant === 'planned' && onEdit && (
          <button
            onClick={onEdit}
            className="text-blue-500 hover:text-blue-700 hover:underline"
          >
            + Add workout
          </button>
        )}
        {variant === 'ai' && <span>No recommendation</span>}
        {variant === 'final' && <span>Not set</span>}
      </div>
    )
  }

  const handleExport = async () => {
    try {
      const res = await trainingApi.exportGarmin(session.id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `workout_${session.session_date}.fit`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // ignore export errors
    }
  }

  const variantLabel =
    variant === 'planned' ? 'Planned' :
    variant === 'ai' ? 'Recommended' :
    'Final'

  return (
    <div
      className={cn(
        'relative rounded-none border-l-2 bg-transparent p-3 pl-4 text-sm',
        variant === 'planned' && 'border-foreground/40',
        variant === 'ai' && 'border-primary',
        variant === 'final' && 'border-foreground',
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] italic smallcaps text-muted-foreground">{variantLabel}.</span>
      </div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={cn('text-xs', workoutTypeColor(workout.type))}>
            {workout.type.replace('_', ' ')}
          </Badge>
          {workout.sport && workout.sport !== 'running' && (() => {
            const { Icon, color, label } = planningSportTheme(workout.sport)
            return (
              <Badge variant="outline" className="gap-1 text-xs" style={{ color }}>
                <Icon className="h-3 w-3" />
                {label}
              </Badge>
            )
          })()}
          {workout.training_phase && (
            <Badge variant="outline" className={cn('text-[10px]', phaseColor(workout.training_phase))}>
              {workout.training_phase}
            </Badge>
          )}
          {workout.terrain && (
            <Badge variant="outline" className="text-[10px]">
              {workout.terrain}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {variant === 'planned' && onEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {(variant === 'planned' || variant === 'ai') && onAccept && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={onAccept}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          {variant === 'final' && session.final_workout && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExport}>
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs leading-relaxed text-foreground/80">
        {workout.description}
      </p>

      {/* Interval sets from AI plans, e.g. "6× 800m @ 3:45 (90s jog)" */}
      {workout.intervals && workout.intervals.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {workout.intervals.map((ivl, i) => {
            const parts: string[] = []
            if (ivl.reps) parts.push(`${ivl.reps}×`)
            if (ivl.distance_m) parts.push(`${ivl.distance_m}m`)
            else if (ivl.duration_sec) parts.push(`${Math.round(ivl.duration_sec / 60)}min`)
            if (ivl.target_pace) parts.push(`@ ${ivl.target_pace}`)
            const line = parts.join(' ')
            return (
              <p key={i} className="text-xs tabular-nums text-foreground/80">
                {line}
                {ivl.recovery ? ` (${ivl.recovery})` : ''}
              </p>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {workout.distance_km && (
          <span>{formatDistanceKm(workout.distance_km)}</span>
        )}
        {workout.duration_min && <span>{workout.duration_min} min</span>}
        {workout.pace_range && <span>{workout.pace_range}</span>}
        {workout.power_target_watts && <span>{workout.power_target_watts}W</span>}
        {workout.hr_zone && <span>{workout.hr_zone}</span>}
        {workout.intensity && (
          <span className="capitalize">{workout.intensity}</span>
        )}
        {workout.elevation_target_m && (
          <span>{workout.elevation_target_m}m D+</span>
        )}
        {workout.estimated_load && (
          <span title="Estimated TRIMP">load {Math.round(workout.estimated_load)}</span>
        )}
        {workout.rpe_target && (
          <span title="Target RPE">RPE {workout.rpe_target}</span>
        )}
      </div>

      {/* Alternative workout swap button */}
      {workout.alternative_workout && (variant === 'ai' || variant === 'planned') && onSwapAlternative && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onSwapAlternative}
        >
          <ArrowRightLeft className="h-3 w-3" />
          <span className="truncate">
            Swap to easier: {workout.alternative_workout.description || workout.alternative_workout.type}
          </span>
        </Button>
      )}

      {variant === 'final' && session.accepted_source && (
        <p className="mt-2 text-[10px] italic smallcaps text-muted-foreground">
          From {session.accepted_source === 'planned' ? 'manual plan' : 'AI'}
        </p>
      )}

      {/* Planned vs Actual comparison */}
      {variant === 'final' && session.completed_activity_summary && session.final_workout && (
        <ComparisonOverlay
          planned={session.final_workout}
          actual={session.completed_activity_summary}
        />
      )}

      {/* RPE input for completed sessions */}
      {variant === 'final' && session.completed_activity_id && (
        <RpeInput
          value={session.rpe_actual}
          onChange={(rpe) => {
            updateSession.mutate({ id: session.id, data: { rpe_actual: rpe } })
          }}
        />
      )}
    </div>
  )
}