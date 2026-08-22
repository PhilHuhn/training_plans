'use client'
import { cn } from '@/lib/utils'
import type { CompromiseMode, CompromiseWire } from '@/lib/types'

/** Short mode labels for the smallcaps badge. */
const MODE_LABEL: Record<CompromiseMode, string> = {
  SHARED_PACE: 'Together',
  SHARED_EASY_SEGMENT: 'Easy portion',
  SHARED: 'Threshold together',
  PARALLEL_TIME_BASED: 'Parallel (time)',
  PARALLEL_SAME_STRUCTURE: 'Parallel (track)',
  COLOCATED_OPTIONAL: 'Same location',
}

const SHARED_MODES: ReadonlySet<string> = new Set([
  'SHARED_PACE',
  'SHARED_EASY_SEGMENT',
  'SHARED',
])

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface CompromiseCardProps {
  compromise: CompromiseWire
  memberNames: Map<number, string>
}

export default function CompromiseCard({ compromise, memberNames }: CompromiseCardProps) {
  const trulyShared = SHARED_MODES.has(compromise.mode)
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 px-1.5 py-1.5 text-left',
        'border-l-2 pl-1.5',
        trulyShared ? 'border-primary' : 'border-foreground/30',
      )}
    >
      <div className="flex items-baseline justify-between gap-1 leading-tight">
        <span
          className={cn(
            'truncate text-[11px] font-semibold smallcaps',
            trulyShared ? 'text-primary' : 'text-foreground',
          )}
        >
          {MODE_LABEL[compromise.mode] ?? compromise.mode}
        </span>
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
          {compromise.member_ids
            .map((id) => initialsOf(memberNames.get(id) ?? '?'))
            .join(' ')}
        </span>
      </div>
      <div className="text-[10px] italic leading-snug text-muted-foreground">
        {compromise.note}
      </div>
      {compromise.shifted?.map((s) => (
        <div key={s.session_id} className="text-[9px] italic text-accent">
          moved: {s.from.slice(5)} → {s.to.slice(5)}
        </div>
      ))}
    </div>
  )
}
