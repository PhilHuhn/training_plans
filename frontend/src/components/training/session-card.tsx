import { useState } from 'react'
import { Check, Pencil, Download, Bike, Waves, Dumbbell, Mountain, Ship, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, workoutTypeColor, sportColor, formatDistanceKm, phaseColor, rpeColor, formatPace } from '@/lib/utils'
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
    <div className="mt-2 border-t border-[#092B37]/20 pt-1">
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
    <div className="mt-2 border-t border-[#092B37]/20 pt-1">
      <p className="mb-1 text-[10px] text-muted-foreground">How did it feel? (RPE)</p>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-none border border-[#092B37] text-[9px] font-bold transition-colors',
              value === n
                ? cn(rpeColor(n), 'border-2')
                : 'bg-background hover:bg-accent',
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
          'flex h-full min-h-[80px] items-center justify-center rounded-none border-2 border-dashed border-[#092B37] p-3 text-xs text-muted-foreground',
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

  return (
    <div
      className={cn(
        'rounded-none border-2 border-[#092B37] p-3 text-sm shadow-brutal-sm',
        variant === 'planned' && 'bg-[#DBEAFE]',
        variant === 'ai' && 'bg-[#EDE9FE]',
        variant === 'final' && 'bg-[#D1FAE5]',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={cn('text-xs', workoutTypeColor(workout.type))}>
            {workout.type.replace('_', ' ')}
          </Badge>
          {workout.sport && workout.sport !== 'running' && (
            <Badge variant="outline" className={cn('text-xs gap-1', sportColor(workout.sport))}>
              {workout.sport === 'cycling' && <Bike className="h-3 w-3" />}
              {workout.sport === 'swimming' && <Waves className="h-3 w-3" />}
              {workout.sport === 'strength' && <Dumbbell className="h-3 w-3" />}
              {workout.sport === 'hiking' && <Mountain className="h-3 w-3" />}
              {workout.sport === 'rowing' && <Ship className="h-3 w-3" />}
              {workout.sport}
            </Badge>
          )}
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
          {variant === 'final' && session.final_workout?.structured && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExport}>
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs leading-relaxed text-foreground/80">
        {workout.description}
      </p>

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
          Swap to easier version
        </Button>
      )}

      {variant === 'final' && session.accepted_source && (
        <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
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
