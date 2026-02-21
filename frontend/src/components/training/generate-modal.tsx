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
import { Sparkles } from 'lucide-react'
import { useGenerateRecommendations } from '@/hooks/use-training'
import { formatDateISO, addDays } from '@/lib/utils'

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  weekStart: string
}

export default function GenerateModal({ open, onClose, weekStart }: GenerateModalProps) {
  const [startDate, setStartDate] = useState(weekStart)
  const [endDate, setEndDate] = useState(addDays(weekStart, 6))
  const generate = useGenerateRecommendations()

  const handleGenerate = () => {
    generate.mutate(
      { start_date: startDate, end_date: endDate },
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
            The AI will analyze your recent activities, upcoming competitions, and training zones to generate personalized recommendations.
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
