'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, CalendarClock } from 'lucide-react'
import StageProgress from '@/components/training/stage-progress'
import { useGenerateRecommendations } from '@/hooks/use-training'
import { useCompetitions } from '@/hooks/use-competitions'
import { addDays, daysBetween, cn } from '@/lib/utils'
import { planningSportTheme } from '@/lib/sport-theme'
import type { Competition } from '@/lib/types'

const MAX_WEEKS = 16

// Labels, icons and colours all come from @/lib/sport-theme so a sport looks
// the same here as it does on the activities charts.
const ALL_SPORTS = (
  ['running', 'cycling', 'swimming', 'strength', 'hiking', 'rowing'] as const
).map((id) => ({ id, locked: id === 'running', ...planningSportTheme(id) }))

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  weekStart: string
}

// Real progress from the server's SSE feed. Stages are reported live by the
// generation pipeline; the session counter comes from the partial JSON as
// Claude writes it out.
type GenerationStage = 'preparing' | 'thinking' | 'writing' | 'saving'

export interface GenerationState {
  stage: GenerationStage
  sessions: number
}

const STAGE_ORDER: GenerationStage[] = ['preparing', 'thinking', 'writing', 'saving']

const STAGE_LABELS: Record<GenerationStage, (sessions: number) => string> = {
  preparing: () => 'Collecting training history, zones & competitions',
  thinking: () => 'Structuring the plan — volumes, long runs, quality sessions, recovery weeks',
  writing: (sessions) => (sessions > 0 ? `Writing sessions — ${sessions} so far` : 'Writing sessions'),
  saving: () => 'Saving plan to your calendar',
}

function GenerationProgress({ state, elapsed }: { state: GenerationState; elapsed: number }) {
  return (
    <StageProgress
      order={STAGE_ORDER}
      active={state.stage}
      label={(stage) => STAGE_LABELS[stage](stage === 'writing' ? state.sessions : 0)}
      elapsed={elapsed}
      note="long plans can take a few minutes — please keep this window open."
    />
  )
}

interface SportConfig {
  startDate: string
}

export default function GenerateModal({ open, onClose, weekStart }: GenerateModalProps) {
  const { data: competitions } = useCompetitions()
  const generate = useGenerateRecommendations()

  // Compute smart end date from last competition
  const smartEndDate = useMemo(() => {
    const maxEnd = addDays(weekStart, MAX_WEEKS * 7)

    if (!competitions || competitions.length === 0) {
      return { date: maxEnd, competition: null as Competition | null }
    }

    // Find the last future competition within the 16-week window
    const futureComps = competitions
      .filter((c: Competition) => c.race_date >= weekStart && c.race_date <= maxEnd)
      .sort((a: Competition, b: Competition) => b.race_date.localeCompare(a.race_date))

    if (futureComps.length > 0) {
      const lastComp = futureComps[0]
      return { date: addDays(lastComp.race_date, 3), competition: lastComp }
    }

    return { date: maxEnd, competition: null as Competition | null }
  }, [competitions, weekStart])

  // State
  const [startDate, setStartDate] = useState(weekStart)
  const [endDate, setEndDate] = useState(smartEndDate.date)
  const [sportConfig, setSportConfig] = useState<Map<string, SportConfig>>(
    () => new Map(ALL_SPORTS.map((s) => [s.id, { startDate: weekStart }])),
  )

  // Reset when modal opens or smart end date updates
  useEffect(() => {
    if (open) {
      setStartDate(weekStart)
      setEndDate(smartEndDate.date)
      setSportConfig(new Map(ALL_SPORTS.map((s) => [s.id, { startDate: weekStart }])))
    }
  }, [open, weekStart, smartEndDate.date])

  // Live progress from the SSE feed + elapsed-seconds ticker
  const [progress, setProgress] = useState<GenerationState>({ stage: 'preparing', sessions: 0 })
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!generate.isPending) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [generate.isPending])

  const toggleSport = (sportId: string) => {
    setSportConfig((prev) => {
      const next = new Map(prev)
      if (next.has(sportId)) {
        next.delete(sportId)
      } else {
        next.set(sportId, { startDate })
      }
      return next
    })
  }

  const updateSportStart = (sportId: string, date: string) => {
    setSportConfig((prev) => {
      const next = new Map(prev)
      next.set(sportId, { startDate: date })
      return next
    })
  }

  // Check if any sport has a delayed start
  const hasDelayedSports = useMemo(() => {
    return Array.from(sportConfig.values()).some((c) => c.startDate > startDate)
  }, [sportConfig, startDate])

  const handleGenerate = () => {
    // Build sport_availability object
    const sportAvailability: Record<string, { start_date: string }> = {}
    for (const [sportId, config] of sportConfig.entries()) {
      sportAvailability[sportId] = { start_date: config.startDate }
    }

    setProgress({ stage: 'preparing', sessions: 0 })
    generate.mutate(
      {
        params: {
          start_date: startDate,
          end_date: endDate,
          sport_availability: JSON.stringify(sportAvailability),
        },
        onProgress: (event) => {
          if (event.type === 'status' && event.stage) {
            setProgress((prev) => ({
              stage: event.stage!,
              sessions: event.sessions ?? prev.sessions,
            }))
          }
        },
      },
      { onSuccess: onClose },
    )
  }

  const totalDays = Math.max(daysBetween(startDate, endDate), 1)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !generate.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Generate AI Training Plan
          </DialogTitle>
          <DialogDescription>
            {generate.isPending
              ? 'Your plan is being generated — this runs through several phases.'
              : 'The AI will analyze your recent activities, upcoming competitions, and training zones to generate personalized recommendations.'}
          </DialogDescription>
        </DialogHeader>

        {generate.isPending ? (
          <GenerationProgress state={progress} elapsed={elapsed} />
        ) : (
        <div className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {smartEndDate.competition && endDate === smartEndDate.date && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground -mt-2">
              <CalendarClock className="h-3 w-3" />
              Based on {smartEndDate.competition.name} ({smartEndDate.competition.race_type}) + 3 days
            </p>
          )}

          {/* Per-sport selection chips */}
          <div className="space-y-1.5">
            <Label>Sports to include</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SPORTS.map((sport) => {
                const isSelected = sportConfig.has(sport.id)
                const Icon = sport.Icon
                return (
                  <button
                    key={sport.id}
                    type="button"
                    disabled={sport.locked}
                    onClick={() => !sport.locked && toggleSport(sport.id)}
                    style={isSelected ? { borderColor: sport.color, color: sport.color } : undefined}
                    className={cn(
                      'flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-secondary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                      sport.locked && 'cursor-default opacity-80',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {sport.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Per-sport availability timeline */}
          <div className="space-y-1.5">
            <Label className="flex items-center justify-between">
              <span>Sport availability</span>
              {!hasDelayedSports && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  All sports from start
                </span>
              )}
            </Label>
            <div className="space-y-1">
              {ALL_SPORTS.filter((s) => sportConfig.has(s.id)).map((sport) => {
                const Icon = sport.Icon
                const config = sportConfig.get(sport.id)!
                const offsetDays = Math.max(daysBetween(startDate, config.startDate), 0)
                const leftPct = (offsetDays / totalDays) * 100
                const widthPct = 100 - leftPct

                return (
                  <div key={sport.id} className="group">
                    <div className="flex items-center gap-2">
                      <div className="flex w-20 shrink-0 items-center gap-1.5">
                        <Icon className="h-3 w-3" style={{ color: sport.color }} />
                        <span className="text-xs font-medium truncate">{sport.label}</span>
                      </div>
                      {/* Timeline bar */}
                      <div className="flex-1 h-5 rounded bg-muted/50 relative overflow-hidden">
                        <div
                          className={cn('absolute inset-y-0 rounded', sport.color, 'opacity-40')}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                        {offsetDays > 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                            from week {Math.ceil(offsetDays / 7)}
                          </span>
                        )}
                      </div>
                      {/* Date picker */}
                      <Input
                        type="date"
                        value={config.startDate}
                        min={startDate}
                        max={endDate}
                        onChange={(e) => updateSportStart(sport.id, e.target.value)}
                        className="h-6 w-[130px] shrink-0 text-[11px] px-1.5"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {generate.error && (
          <p className="text-sm text-destructive">
            {generate.error instanceof Error && generate.error.message
              ? generate.error.message
              : 'Failed to generate. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}