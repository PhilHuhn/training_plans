import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SessionCard from './session-card'
import { cn, formatDateShort, isToday, addDays } from '@/lib/utils'
import type { TrainingWeekResponse, TrainingSession } from '@/lib/types'
import { useDeleteSession, useAcceptWorkout } from '@/hooks/use-training'

interface TrainingWeekProps {
  data?: TrainingWeekResponse
  onEditSession: (session: TrainingSession, date: string) => void
  onAddSession: (date: string) => void
}

export default function TrainingWeek({ data, onEditSession, onAddSession }: TrainingWeekProps) {
  const deleteSession = useDeleteSession()
  const acceptWorkout = useAcceptWorkout()

  if (!data) return null

  // Build a map of sessions by date
  const sessionsByDate = new Map<string, TrainingSession>()
  for (const s of data.sessions) {
    sessionsByDate.set(s.session_date, s)
  }

  // Generate 7 days from week_start
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    days.push(addDays(data.week_start, i))
  }

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="hidden grid-cols-3 gap-3 px-2 lg:grid">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-blue-600">
          Manual / Uploaded
        </p>
        <p className="text-center text-xs font-medium uppercase tracking-wider text-violet-600">
          AI Recommendation
        </p>
        <p className="text-center text-xs font-medium uppercase tracking-wider text-emerald-600">
          Final Plan
        </p>
      </div>

      {days.map((dateStr) => {
        const session = sessionsByDate.get(dateStr)
        const today = isToday(dateStr)

        return (
          <div
            key={dateStr}
            className={cn(
              'rounded-none border-2 border-[#092B37] bg-card p-3',
              today && 'ring-4 ring-primary',
            )}
          >
            {/* Day header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatDateShort(dateStr)}</span>
                {today && (
                  <Badge variant="secondary" className="bg-[#FBBF24] text-[#092B37] text-xs">
                    Today
                  </Badge>
                )}
              </div>
              {session && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteSession.mutate(session.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Three columns */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <SessionCard
                workout={session?.planned_workout}
                variant="planned"
                session={session!}
                onEdit={() =>
                  session
                    ? onEditSession(session, dateStr)
                    : onAddSession(dateStr)
                }
                onAccept={
                  session?.planned_workout
                    ? () => acceptWorkout.mutate({ id: session.id, source: 'planned' })
                    : undefined
                }
              />
              <SessionCard
                workout={session?.recommendation_workout}
                variant="ai"
                session={session!}
                onAccept={
                  session?.recommendation_workout
                    ? () => acceptWorkout.mutate({ id: session.id, source: 'ai' })
                    : undefined
                }
              />
              <SessionCard
                workout={session?.final_workout}
                variant="final"
                session={session!}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
