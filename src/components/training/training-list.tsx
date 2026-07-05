'use client'
import { Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn, isToday, addDays, formatDistanceKm } from '@/lib/utils'
import type { TrainingSession } from '@/lib/types'
import type { TrainingRangeResponse } from '@/api/training'
import { displayedWorkout, typeLabel, SOURCE_PILL } from './training-grid'

interface TrainingListProps {
  data?: TrainingRangeResponse
  onOpenSession: (date: string, session?: TrainingSession) => void
}

/** Format YYYY-MM-DD as "May 4". */
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
}

/** Weekday abbreviation for an ISO date. */
function weekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleString('en', { weekday: 'short', timeZone: 'UTC' })
}

/**
 * Spreadsheet-like list view of the plan: one row per day, grouped by week
 * with a compact week separator row (phase + weekly km). Days without a
 * session render as muted "Rest" rows — clicking them adds a session.
 */
export default function TrainingList({ data, onOpenSession }: TrainingListProps) {
  const weeks = data?.weeks ?? []
  if (weeks.length === 0) return null

  // Sticky header note: `overflow-x-auto` creates a scroll container, which
  // breaks `position: sticky` against the page scroller — so horizontal
  // scrolling is enabled only below lg, where the sticky header is dispensable.
  const stickyTh =
    'sticky top-0 z-10 bg-background border-b border-foreground/40 py-1.5 pr-2 font-normal'

  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      {/* booktabs: heavy top rule, hairline mid, heavy bottom */}
      <table className="w-full min-w-[640px] border-t-2 border-foreground text-xs">
        <thead>
          <tr className="text-left text-[11px] italic smallcaps text-muted-foreground">
            <th className={stickyTh}>Date</th>
            <th className={stickyTh}>Day</th>
            <th className={stickyTh}>Type</th>
            <th className={cn(stickyTh, 'text-right')}>Dist</th>
            <th className={cn(stickyTh, 'text-right')}>Time</th>
            <th className={stickyTh}>Pace / Intensity</th>
            <th className={stickyTh}>Description</th>
            <th className={cn(stickyTh, 'pr-0')}>Src</th>
          </tr>
        </thead>
        <tbody className="border-b-2 border-foreground">
          {weeks.map((week, wi) => {
            const totalKm =
              week.total_distance_final ||
              week.total_distance_planned ||
              week.total_distance_recommended ||
              0
            // One row per calendar day: sessionless days become "Rest" rows.
            const sessionByDate = new Map(week.sessions.map((s) => [s.session_date, s]))
            const rows = Array.from({ length: 7 }, (_, di) => {
              const date = addDays(week.week_start, di)
              const session = sessionByDate.get(date)
              return { date, session, disp: session ? displayedWorkout(session) : null }
            })

            return (
              <Fragment key={week.week_start}>
                {/* Week separator row */}
                <tr className="border-b border-foreground/25 bg-foreground/[0.03]">
                  <td colSpan={8} className="py-1 pr-2">
                    <span className="font-serif text-xs font-semibold">Week {wi + 1}</span>
                    <span className="ml-2 text-[10px] italic text-muted-foreground">
                      {formatDay(week.week_start)}
                    </span>
                    {week.training_phase && (
                      <Badge variant="outline" className="ml-2 text-[9px] italic capitalize">
                        {week.training_phase}
                      </Badge>
                    )}
                    {totalKm > 0 && (
                      <span className="float-right text-[11px] tabular-nums text-foreground/80">
                        {totalKm.toFixed(0)} km
                      </span>
                    )}
                  </td>
                </tr>

                {rows.map(({ date, session, disp }) => {
                  // Day without a session (or a session without any workout):
                  // render a muted Rest row; clicking it adds a session.
                  if (!disp) {
                    return (
                      <tr
                        key={date}
                        onClick={() => onOpenSession(date, session)}
                        className={cn(
                          'cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/[0.04]',
                          isToday(date) && 'bg-foreground/[0.04]',
                        )}
                      >
                        <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums text-muted-foreground/70">
                          {formatDay(date)}
                        </td>
                        <td className="py-1.5 pr-2 text-muted-foreground/70">{weekday(date)}</td>
                        <td className="py-1.5 pr-2 italic text-muted-foreground/70">Rest</td>
                        <td className="py-1.5 pr-2 text-right text-muted-foreground/40">—</td>
                        <td className="py-1.5 pr-2 text-right text-muted-foreground/40">—</td>
                        <td className="py-1.5 pr-2 text-muted-foreground/40">—</td>
                        <td className="py-1.5 pr-2 text-muted-foreground/40" />
                        <td className="py-1.5" />
                      </tr>
                    )
                  }

                  const w = disp.workout
                  const source = disp.source
                  const type = w.type
                  const isRest = type === 'rest'
                  const isRace = type === 'race'
                  const isQuality =
                    type === 'tempo' || type === 'interval' || type === 'threshold' || type === 'long_run'
                  const paceOrIntensity = w.pace_range ?? w.hr_zone ?? w.intensity ?? ''
                  return (
                    <tr
                      key={date}
                      onClick={() => onOpenSession(date, session)}
                      className={cn(
                        'cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/[0.04]',
                        isToday(date) && 'bg-foreground/[0.04]',
                      )}
                    >
                      <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">
                        {formatDay(date)}
                      </td>
                      <td className="py-1.5 pr-2 text-muted-foreground">
                        {weekday(date)}
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap py-1.5 pr-2',
                          isQuality && 'border-l-2 border-primary pl-1.5 font-semibold',
                          isRace && 'border-l-2 border-accent pl-1.5 font-bold smallcaps text-accent',
                          isRest && 'italic text-muted-foreground',
                        )}
                      >
                        {typeLabel(type)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {w.distance_km ? formatDistanceKm(w.distance_km) : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {w.duration_min ? `${w.duration_min} min` : '—'}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums text-foreground/80">
                        {paceOrIntensity || '—'}
                      </td>
                      <td className="max-w-[320px] truncate py-1.5 pr-2 text-foreground/80">
                        {w.description}
                      </td>
                      <td className="py-1.5 text-[10px] italic text-muted-foreground">
                        {SOURCE_PILL[source]}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] italic text-muted-foreground">
        Click a row to open or add a session. Days without a session show as Rest.
      </p>
    </div>
  )
}
