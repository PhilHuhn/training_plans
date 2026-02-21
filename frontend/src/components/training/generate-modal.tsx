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
import { Sparkles, Footprints, Bike, Waves, Dumbbell, Mountain, Ship, CalendarClock } from 'lucide-react'
import { useGenerateRecommendations } from '@/hooks/use-training'
import { useCompetitions } from '@/hooks/use-competitions'
import { addDays, daysBetween, cn } from '@/lib/utils'
import type { Competition } from '@/lib/types'

const MAX_WEEKS = 16

const ALL_SPORTS = [
  { id: 'running', label: 'Running', icon: Footprints, locked: true, color: 'bg-green-400' },
  { id: 'cycling', label: 'Cycling', icon: Bike, locked: false, color: 'bg-yellow-400' },
  { id: 'swimming', label: 'Swimming', icon: Waves, locked: false, color: 'bg-blue-400' },
  { id: 'strength', label: 'Strength', icon: Dumbbell, locked: false, color: 'bg-rose-400' },
  { id: 'hiking', label: 'Hiking', icon: Mountain, locked: false, color: 'bg-amber-400' },
  { id: 'rowing', label: 'Rowing', icon: Ship, locked: false, color: 'bg-indigo-400' },
] as const

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  weekStart: string
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

    generate.mutate(
      {
        start_date: startDate,
        end_date: endDate,
        sport_availability: JSON.stringify(sportAvailability),
      },
      { onSuccess: onClose },
    )
  }

  const totalDays = Math.max(daysBetween(startDate, endDate), 1)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Generate AI Training Plan
          </DialogTitle>
          <DialogDescription>
            The AI will analyze your recent activities, upcoming competitions, and training zones to
            generate personalized recommendations.
          </DialogDescription>
        </DialogHeader>

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
                const Icon = sport.icon
                return (
                  <button
                    key={sport.id}
                    type="button"
                    disabled={sport.locked}
                    onClick={() => !sport.locked && toggleSport(sport.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      isSelected
                        ? 'border-violet-300 bg-violet-50 text-violet-700'
                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-500',
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
                const Icon = sport.icon
                const config = sportConfig.get(sport.id)!
                const offsetDays = Math.max(daysBetween(startDate, config.startDate), 0)
                const leftPct = (offsetDays / totalDays) * 100
                const widthPct = 100 - leftPct

                return (
                  <div key={sport.id} className="group">
                    <div className="flex items-center gap-2">
                      <div className="flex w-20 shrink-0 items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground" />
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

        {generate.error && (
          <p className="text-sm text-destructive">Failed to generate. Please try again.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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
