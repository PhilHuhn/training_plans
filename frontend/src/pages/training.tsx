import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import WeekSummary from '@/components/training/week-summary'
import TrainingWeek from '@/components/training/training-week'
import SessionModal from '@/components/training/session-modal'
import GenerateModal from '@/components/training/generate-modal'
import { useTrainingWeek } from '@/hooks/use-training'
import { getWeekStart, addDays, formatDateISO, formatDateShort } from '@/lib/utils'
import type { TrainingSession } from '@/lib/types'

export default function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const weekStart = weekParam || getWeekStart(new Date())

  const { data, isLoading } = useTrainingWeek(weekStart)

  const [sessionModal, setSessionModal] = useState<{
    open: boolean
    session?: TrainingSession
    date: string
  }>({ open: false, date: '' })

  const [generateOpen, setGenerateOpen] = useState(false)

  const navigateWeek = (offset: number) => {
    const newWeek = addDays(weekStart, offset * 7)
    setSearchParams({ week: newWeek })
  }

  const goToday = () => {
    setSearchParams({ week: getWeekStart(new Date()) })
  }

  const weekEnd = addDays(weekStart, 6)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {formatDateShort(weekStart)} - {formatDateShort(weekEnd)}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-500" />
            AI Plan
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <WeekSummary data={data} />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading training week...
        </div>
      )}

      {/* Week view */}
      {data && (
        <TrainingWeek
          data={data}
          onEditSession={(session, date) =>
            setSessionModal({ open: true, session, date })
          }
          onAddSession={(date) => setSessionModal({ open: true, date })}
        />
      )}

      {/* Modals */}
      <SessionModal
        open={sessionModal.open}
        onClose={() => setSessionModal({ open: false, date: '' })}
        session={sessionModal.session}
        date={sessionModal.date}
      />

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        weekStart={weekStart}
      />
    </div>
  )
}
