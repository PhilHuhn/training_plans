'use client'
import { useMemo } from 'react'
import { typeLabel } from '@/components/training/training-grid'
import CompromiseCard from '@/components/club/compromise-card'
import { cn, addDays, isToday, formatDistanceKm } from '@/lib/utils'
import type { ClubMemberSessionWire, ClubOverlayResponse } from '@/lib/types'

// Same column skeleton as training-grid.tsx, with the week-label column
// repurposed as the athlete column.
const GRID_COLS = 'grid-cols-[110px_repeat(7,minmax(0,1fr))_56px]'
const DAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  captain: 'Captain',
  athlete: 'Athlet:in',
}

function MemberCell({ session }: { session: ClubMemberSessionWire | undefined }) {
  if (!session) {
    return <div className="h-full border-l border-foreground/10 px-1.5 py-1.5" />
  }
  const type = session.session_type ?? undefined
  const isRest = type === 'rest'
  const isRace = type === 'race'
  const isQuality =
    type === 'tempo' || type === 'interval' || type === 'threshold' || type === 'long_run'

  const metric: string[] = []
  if (!session.redacted && session.distance_km) metric.push(formatDistanceKm(session.distance_km))
  if (session.duration_min) metric.push(`${session.duration_min} min`)

  return (
    <div
      className={cn(
        'h-full border-l border-foreground/10 px-1.5 py-1.5',
        isToday(session.session_date) && 'bg-foreground/[0.04]',
      )}
    >
      <div
        className={cn(
          'flex h-full min-w-0 flex-col gap-0.5',
          isQuality && 'border-l-2 border-primary pl-1.5 -ml-1.5',
          isRace && 'border-l-2 border-accent pl-1.5 -ml-1.5',
        )}
      >
        <span
          className={cn(
            'truncate text-[11px] leading-tight',
            isRest && 'italic smallcaps text-muted-foreground',
            isRace && 'font-bold smallcaps text-accent',
            !isRest && !isRace && 'font-semibold text-foreground',
          )}
        >
          {typeLabel(type)}
        </span>
        {metric.length > 0 && (
          <span className="truncate text-[11px] tabular-nums text-foreground/80">
            {metric.join(' · ')}
          </span>
        )}
        {!session.redacted && (session.pace_range || session.hr_zone || session.intensity) && (
          <span className="truncate text-[10px] italic text-muted-foreground">
            {session.pace_range ?? session.hr_zone ?? session.intensity}
          </span>
        )}
        {session.redacted && (
          <span className="truncate text-[9px] italic text-muted-foreground/60">nur Typ</span>
        )}
      </div>
    </div>
  )
}

interface ClubOverlayGridProps {
  data: ClubOverlayResponse
}

export default function ClubOverlayGrid({ data }: ClubOverlayGridProps) {
  const memberNames = useMemo(
    () => new Map(data.rows.map((r) => [r.user_id, r.name])),
    [data.rows],
  )

  const compromisesByDay = useMemo(() => {
    const map = new Map<number, typeof data.shared>()
    for (const c of data.shared) map.set(c.weekday, [...(map.get(c.weekday) ?? []), c])
    return map
  }, [data.shared])

  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <div className="min-w-[760px]">
        {/* Header row */}
        <div
          className={cn(
            'sticky top-0 z-10 grid items-end border-b border-foreground/30 bg-background pb-1 pt-1 text-[11px] italic smallcaps text-muted-foreground',
            GRID_COLS,
          )}
        >
          <div className="px-1.5">Athlet:in</div>
          {DAY_HEADERS.map((d, i) => (
            <div
              key={d}
              className={cn('px-1.5', isToday(addDays(data.week_start, i)) && 'text-foreground')}
            >
              {d} {addDays(data.week_start, i).slice(8)}
            </div>
          ))}
          <div className="px-1.5 text-right">km</div>
        </div>

        {/* One row per athlete */}
        {data.rows.map((row) => {
          const sessionByDate = new Map(row.sessions.map((s) => [s.session_date, s]))
          const totalKm = row.sessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0)
          return (
            <div
              key={row.user_id}
              className={cn('grid border-b border-foreground/15', GRID_COLS)}
              style={{ minHeight: '68px' }}
            >
              <div className="flex flex-col justify-center gap-0.5 border-r border-foreground/15 px-1.5 py-2">
                <div className="truncate text-xs font-serif">{row.name}</div>
                <div className="text-[9px] italic smallcaps text-muted-foreground">
                  {ROLE_LABEL[row.role] ?? row.role}
                  {row.visibility === 'typ_only' && ' · privat'}
                </div>
              </div>
              {Array.from({ length: 7 }).map((_, di) => {
                const date = addDays(data.week_start, di)
                return <MemberCell key={date} session={sessionByDate.get(date)} />
              })}
              <div className="flex items-center justify-end px-1.5 text-xs tabular-nums text-foreground/80">
                {totalKm > 0 ? (
                  <span>{totalKm.toFixed(0)}</span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
            </div>
          )
        })}

        {/* "Gemeinsam" row — thicker top rule, booktabs-style. */}
        <div
          className={cn('grid border-b border-t-2 border-foreground/40', GRID_COLS)}
          style={{ minHeight: '76px' }}
        >
          <div className="flex flex-col justify-center border-r border-foreground/15 px-1.5 py-2">
            <div className="text-xs font-serif italic">Gemeinsam</div>
            <div className="text-[9px] italic smallcaps text-muted-foreground">Overlay</div>
          </div>
          {Array.from({ length: 7 }).map((_, di) => {
            const items = compromisesByDay.get(di) ?? []
            return (
              <div key={di} className="flex flex-col gap-1 border-l border-foreground/10 py-1">
                {items.map((c, i) => (
                  <CompromiseCard key={`${c.mode}-${i}`} compromise={c} memberNames={memberNames} />
                ))}
              </div>
            )
          })}
          <div />
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] italic text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-0.5 border-l-2 border-primary" aria-hidden />
            gemeinsame Einheit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-0.5 border-l-2 border-foreground/30" aria-hidden />
            parallel / gleiche Location
          </span>
          <span>„privat" — Athlet:in teilt nur Verfügbarkeit + Typ</span>
        </div>
      </div>
    </div>
  )
}
