import { useState } from 'react'
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
import { Sparkles, Footprints, Bike, Waves, Dumbbell, Mountain, Ship } from 'lucide-react'
import { useGenerateRecommendations } from '@/hooks/use-training'
import { addDays, cn } from '@/lib/utils'

const ALL_SPORTS = [
  { id: 'running', label: 'Running', icon: Footprints, locked: true },
  { id: 'cycling', label: 'Cycling', icon: Bike, locked: false },
  { id: 'swimming', label: 'Swimming', icon: Waves, locked: false },
  { id: 'strength', label: 'Strength', icon: Dumbbell, locked: false },
  { id: 'hiking', label: 'Hiking', icon: Mountain, locked: false },
  { id: 'rowing', label: 'Rowing', icon: Ship, locked: false },
] as const

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  weekStart: string
}

export default function GenerateModal({ open, onClose, weekStart }: GenerateModalProps) {
  const [startDate, setStartDate] = useState(weekStart)
  const [endDate, setEndDate] = useState(addDays(weekStart, 6))
  const [selectedSports, setSelectedSports] = useState<Set<string>>(
    () => new Set(ALL_SPORTS.map((s) => s.id)),
  )
  const generate = useGenerateRecommendations()

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) => {
      const next = new Set(prev)
      if (next.has(sportId)) {
        next.delete(sportId)
      } else {
        next.add(sportId)
      }
      return next
    })
  }

  const handleGenerate = () => {
    generate.mutate(
      {
        start_date: startDate,
        end_date: endDate,
        sports: Array.from(selectedSports).join(','),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
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

        <div className="space-y-3">
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

          {/* Per-sport selection */}
          <div className="space-y-1.5">
            <Label>Sports to include</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SPORTS.map((sport) => {
                const isSelected = selectedSports.has(sport.id)
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
