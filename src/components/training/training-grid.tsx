'use client'
import { Fragment, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, isToday, addDays, formatDistanceKm } from '@/lib/utils'
import type { TrainingSession, WorkoutDetails } from '@/lib/types'
import type { TrainingRangeResponse } from '@/api/training'
import { useDeleteSession } from '@/hooks/use-training'

interface TrainingGridProps {
  data?: TrainingRangeResponse
  onOpenSession: (date: string, session?: TrainingSession) => void
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Shared by the header row and every week row so the columns can't drift.
// Week label | 7 day cells | total km — sized to fit the content frame
// without horizontal scroll at typical desktop widths.
const GRID_COLS = 'grid-cols-[88px_repeat(7,minmax(0,1fr))_56px]'

/**
 * Pick the "displayed" workout for a cell: final → AI → planned.
 * Returns null when there is no session at all (an empty cell).
 * Exported for the list view, which uses the same precedence.
 */
export function displayedWorkout(
  session: TrainingSession | undefined,
): { workout: WorkoutDetails; source: 'final' | 'ai' | 'planned' } | null {
  if (!session) return null
  if (session.final_workout) return { workout: session.final_workout, source: 'final' }
  if (session.recommendation_workout) return { workout: session.recommendation_workout, source: 'ai' }
  if (session.planned_workout) return { workout: session.planned_workout, source: 'planned' }
  return null
}

/** Short label rendered in the mini-card type slot. */
export function typeLabel(type: string | undefined): string {
  if (!type) return 'Run'
  const map: Record<string, string> = {
    easy: 'Easy',
    recovery: 'Recovery',
    long_run: 'Long',
    tempo: 'Tempo',
    interval: 'Interval',
    threshold: 'Threshold',
    rest: 'Rest',
    cross_training: 'Cross',
    race: 'Race',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Compact distance/duration string. Hide both if neither is set. */
function metricLine(w: WorkoutDetails | null): string | null {
  if (!w) return null
  const parts: string[] = []
  if (w.distance_km) parts.push(formatDistanceKm(w.distance_km))
  if (w.duration_min) parts.push(`${w.duration_min} min`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Pace or HR zone hint. */
function intensityLine(w: WorkoutDetails | null): string | null {
  if (!w) return null
  if (w.pace_range) return w.pace_range
  if (w.hr_zone) return w.hr_zone
  if (w.intensity) return w.intensity
  return null
}

/** Source-of-truth label for the corner pill. */
export const SOURCE_PILL: Record<'final' | 'ai' | 'planned', string> = {
  final: 'Final',
  ai: 'AI',
  planned: 'Plan',
}

interface CellProps {
  date: string
  session: TrainingSession | undefined
  isFirstOfWeek: boolean
  onOpen: () => void
  onDelete?: () => void
}

function GridCell({ date, session, onOpen, onDelete }: CellProps) {
  const today = isToday(date)
  const disp = displayedWorkout(session)
  const workout = disp?.workout ?? null
  const source = disp?.source ?? null
  const type = workout?.type
  const isRest = type === 'rest'
  const isRace = type === 'race'
  const isQuality =
    type === 'tempo' || type === 'interval' || type === 'threshold' || type === 'long_run'

  return (
    <div className="relative h-full">
      {/* Right-edge delete button only when a session exists */}
      {session && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-destructive group-hover/cell:flex"
          aria-label="Delete session"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={onOpen}
        className={cn(
          'group/cell h-full w-full text-left px-1.5 py-1.5 transition-colors',
          'border-l border-foreground/10',
          today && 'bg-foreground/[0.04]',
        )}
      >
        {!workout && (
          <span className="text-xs italic text-muted-foreground/60">+</span>
        )}
        {workout && (
          <div
            className={cn(
              'flex h-full min-w-0 flex-col gap-0.5',
              isQuality && 'border-l-2 border-primary pl-1.5 -ml-1.5',
              isRace && 'border-l-2 border-accent pl-1.5 -ml-1.5',
            )}
          >
            <div className="flex items-baseline justify-between gap-1 leading-tight">
              <span
                className={cn(
                  'truncate text-[11px]',
                  isRest && 'italic smallcaps text-muted-foreground',
                  isRace && 'font-bold smallcaps text-accent',
                  !isRest && !isRace && 'font-semibold text-foreground',
                )}
              >
                {typeLabel(type)}
              </span>
              {source && source !== 'final' && (
                <span className="shrink-0 text-[9px] italic text-muted-foreground/70">
                  {SOURCE_PILL[source]}
                </span>
              )}
            </div>
            {metricLine(workout) && (
              <div className="truncate text-[11px] tabular-nums text-foreground/80">
                {metricLine(workout)}
              </div>
            )}
            {intensityLine(workout) && (
              <div className="truncate text-[10px] italic text-muted-foreground">
                {intensityLine(workout)}
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  )
}

export default function TrainingGrid({ data, onOpenSession }: TrainingGridProps) {
  const deleteSession = useDeleteSession()
  const weeks = data?.weeks ?? []

  // Build a date → session lookup for fast cell rendering
  const sessionByDate = useMemo(() => {
    const map = new Map<string, TrainingSession>()
    for (const w of weeks) for (const s of w.sessions) map.set(s.session_date, s)
    return map
  }, [weeks])

  if (weeks.length === 0) return null

  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <div className="min-w-[700px]">
        {/* Header row: empty corner + day labels + total. Sticky against the
            page scroller (overflow-x is disabled on lg so sticky can work). */}
        <div className={cn('sticky top-0 z-10 grid items-end border-b border-foreground/30 bg-background pb-1 pt-1 text-[11px] italic smallcaps text-muted-foreground', GRID_COLS)}>
          <div />
          {DAY_HEADERS.map((d) => (
            <div key={d} className="px-1.5">
              {d}
            </div>
          ))}
          <div className="px-1.5 text-right">Total</div>
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => {
          const totalKm =
            week.total_distance_final ||
            week.total_distance_planned ||
            week.total_distance_recommended ||
            0
          return (
            <div
              key={week.week_start}
              className={cn(
                'grid border-b border-foreground/15',
                GRID_COLS,
                wi > 0 && 'border-t-0',
              )}
              style={{ minHeight: '76px' }}
            >
              {/* Week label column */}
              <div className="flex flex-col justify-center gap-0.5 px-1.5 py-2 border-r border-foreground/15">
                <div className="text-xs font-serif">
                  {formatWeekStart(week.week_start)}
                </div>
                {week.training_phase && (
                  <Badge
                    variant="outline"
                    className="w-fit text-[9px] italic capitalize"
                  >
                    {week.training_phase}
                  </Badge>
                )}
              </div>

              {/* 7 day cells */}
              {Array.from({ length: 7 }).map((_, di) => {
                const date = addDays(week.week_start, di)
                const session = sessionByDate.get(date)
                return (
                  <Fragment key={date}>
                    <GridCell
                      date={date}
                      session={session}
                      isFirstOfWeek={di === 0}
                      onOpen={() => onOpenSession(date, session)}
                      onDelete={
                        session
                          ? () => deleteSession.mutate(session.id)
                          : undefined
                      }
                    />
                  </Fragment>
                )
              })}

              {/* Total km */}
              <div className="flex items-center justify-end gap-0.5 px-1.5 text-xs tabular-nums text-foreground/80">
                {totalKm > 0 ? <span>{totalKm.toFixed(0)} km</span> : <span className="text-muted-foreground/60">—</span>}
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] italic text-muted-foreground">
          <LegendKey color="border-primary" label="Quality (tempo / interval / long)" />
          <LegendKey color="border-accent" label="Race" />
          <span>"+" empty day — click to add</span>
          <span>"Plan" / "AI" — source if not yet accepted as Final</span>
        </div>
      </div>
    </div>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-block h-3 w-0.5 border-l-2', color)} aria-hidden />
      {label}
    </span>
  )
}

/** Format YYYY-MM-DD as "May 4". */
function formatWeekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
}

