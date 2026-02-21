import { Check, Pencil, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, workoutTypeColor, formatDistanceKm } from '@/lib/utils'
import type { WorkoutDetails, TrainingSession } from '@/lib/types'
import { trainingApi } from '@/api/training'

interface SessionCardProps {
  workout?: WorkoutDetails
  variant: 'planned' | 'ai' | 'final'
  session: TrainingSession
  onEdit?: () => void
  onAccept?: () => void
}

export default function SessionCard({
  workout,
  variant,
  session,
  onEdit,
  onAccept,
}: SessionCardProps) {
  if (!workout) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[80px] items-center justify-center rounded-xl border-2 border-dashed p-3 text-xs text-muted-foreground',
          variant === 'planned' && 'border-blue-200',
          variant === 'ai' && 'border-violet-200',
          variant === 'final' && 'border-emerald-200',
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
        'rounded-xl border p-3 text-sm transition-shadow hover:shadow-sm',
        variant === 'planned' && 'border-blue-100 bg-blue-50/50',
        variant === 'ai' && 'border-violet-100 bg-violet-50/50',
        variant === 'final' && 'border-emerald-100 bg-emerald-50/50',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Badge variant="secondary" className={cn('text-xs', workoutTypeColor(workout.type))}>
          {workout.type.replace('_', ' ')}
        </Badge>
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
        {workout.hr_zone && <span>{workout.hr_zone}</span>}
        {workout.intensity && (
          <span className="capitalize">{workout.intensity}</span>
        )}
      </div>

      {variant === 'final' && session.accepted_source && (
        <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          From {session.accepted_source === 'planned' ? 'manual plan' : 'AI'}
        </p>
      )}
    </div>
  )
}
