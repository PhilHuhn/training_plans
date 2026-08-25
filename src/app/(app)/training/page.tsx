'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TrainingGrid from '@/components/training/training-grid'
import TrainingList from '@/components/training/training-list'
import SessionModal from '@/components/training/session-modal'
import GenerateModal from '@/components/training/generate-modal'
import IcsToolbar from '@/components/training/ics-toolbar'
import { useTrainingRange } from '@/hooks/use-training'
import { useCurrentUser } from '@/hooks/use-auth'
import { getWeekStart, addDays, formatDateShort } from '@/lib/utils'
import type { TrainingSession } from '@/lib/types'

const DEFAULT_WEEKS = 4

type ViewMode = 'grid' | 'list'
const VIEW_STORAGE_KEY = 'training-view-mode'

export default function TrainingPage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const aiDisabled = user?.ai_enabled === false
  const pathname = usePathname() ?? '/training'
  const searchParams = useSearchParams()

  const startParam = searchParams?.get('start') ?? null
  const weeksParam = parseInt(searchParams?.get('weeks') ?? '', 10)
  const rangeWeeks = Number.isFinite(weeksParam) && weeksParam > 0 ? weeksParam : DEFAULT_WEEKS
  const rangeStart = startParam || getWeekStart(new Date())
  const rangeEnd = addDays(rangeStart, rangeWeeks * 7 - 1)

  const setRangeStart = (iso: string) => {
    router.replace(`${pathname}?start=${encodeURIComponent(iso)}&weeks=${rangeWeeks}`)
  }

  const setRangeWeeks = (n: number) => {
    router.replace(`${pathname}?start=${encodeURIComponent(rangeStart)}&weeks=${n}`)
  }

  const { data, isLoading } = useTrainingRange(rangeStart, rangeWeeks)

  const [sessionModal, setSessionModal] = useState<{
    open: boolean
    session?: TrainingSession
    date: string
  }>({ open: false, date: '' })

  const [generateOpen, setGenerateOpen] = useState(false)

  // View mode: calendar grid vs spreadsheet-like list. Persisted per browser.
  const [view, setView] = useState<ViewMode>('grid')
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'list' || stored === 'grid') setView(stored)
  }, [])
  const changeView = (v: ViewMode) => {
    setView(v)
    window.localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const shiftRange = (offsetWeeks: number) => {
    setRangeStart(addDays(rangeStart, offsetWeeks * 7))
  }

  const goToday = () => {
    setRangeStart(getWeekStart(new Date()))
  }

  // Totals across the visible range
  const totalKm = (data?.weeks ?? []).reduce(
    (s, w) =>
      s +
      (w.total_distance_final ||
        w.total_distance_planned ||
        w.total_distance_recommended ||
        0),
    0,
  )
  const totalLoad = (data?.weeks ?? []).reduce(
    (s, w) => s + (w.total_load_planned ?? 0),
    0,
  )

  const allSessions = (data?.weeks ?? []).flatMap((w) => w.sessions ?? [])
  const completedCount = allSessions.filter((x) => x.status === 'completed').length

  return (
    <>
      {/* Opening band: where you are in the plan, and how to move through it */}
      <div className="surface-band relative overflow-hidden border-b border-foreground/15 px-4 py-5 lg:px-7">
        <div className="relative z-[2] mx-auto flex w-full max-w-6xl flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3.5">
          {/* One segmented control rather than three loose buttons */}
          <div className="flex border border-foreground/25 bg-background/70">
            <button
              type="button"
              onClick={() => shiftRange(-rangeWeeks)}
              aria-label="Previous range"
              className="border-r border-foreground/20 px-2.5 py-1.5 hover:bg-foreground/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="smallcaps border-r border-foreground/20 px-3.5 py-1.5 text-[13px] italic hover:bg-foreground/5"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftRange(rangeWeeks)}
              aria-label="Next range"
              className="px-2.5 py-1.5 hover:bg-foreground/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div>
            <div className="tt-title tabular-nums text-xl">
              {formatDateShort(rangeStart)} — {formatDateShort(rangeEnd)}
            </div>
            <div className="smallcaps text-[11.5px] italic text-muted-foreground">
              {rangeWeeks}-week block
              {data?.weeks?.[0]?.training_phase ? ` · ${data.weeks[0].training_phase} phase` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View mode: grid (calendar) vs list (spreadsheet) */}
          <fieldset className="flex items-center gap-3 text-xs">
            <legend className="sr-only">View mode</legend>
            {(
              [
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ] as { value: ViewMode; label: string }[]
            ).map(({ value, label }) => (
              <label
                key={value}
                className={
                  view === value
                    ? 'flex cursor-pointer items-center gap-1.5 text-foreground'
                    : 'flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground'
                }
              >
                <input
                  type="radio"
                  name="training-view"
                  value={value}
                  checked={view === value}
                  onChange={() => changeView(value)}
                  className="h-3 w-3 accent-foreground"
                />
                <span className="italic smallcaps">{label}</span>
              </label>
            ))}
          </fieldset>

          {/* Range size selector */}
          <div className="flex border border-foreground/25">
            {[4, 6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRangeWeeks(n)}
                className={
                  n === rangeWeeks
                    ? 'smallcaps border-r border-foreground/20 bg-foreground px-3 py-1.5 text-[13px] italic text-background last:border-r-0'
                    : 'smallcaps border-r border-foreground/20 bg-background/70 px-3 py-1.5 text-[13px] italic text-muted-foreground last:border-r-0 hover:text-foreground'
                }
                aria-pressed={n === rangeWeeks}
              >
                {n}w
              </button>
            ))}
          </div>

          <IcsToolbar start={rangeStart} end={rangeEnd} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setGenerateOpen(true)}
            data-tour="ai-plan"
            disabled={aiDisabled}
            title={aiDisabled ? (user?.ai_disabled_notice ?? undefined) : undefined}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-500" />
            AI Plan
          </Button>
        </div>
        </div>
      </div>

      <div data-tour="training-week" className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 lg:px-7">
      {/* Range totals */}
      <div className="rule-top rule-bottom grid grid-cols-2 gap-4 py-3.5 sm:grid-cols-4">
        <div>
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">Range</div>
          <div className="tt-display tabular-nums text-[23px]">{rangeWeeks} weeks</div>
        </div>
        <div>
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">Total km</div>
          <div className="tt-display tabular-nums text-[23px]">{totalKm.toFixed(0)} km</div>
        </div>
        <div>
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">Planned TRIMP</div>
          <div className="tt-display tabular-nums text-[23px]">
            {totalLoad > 0 ? totalLoad.toFixed(0) : '—'}
          </div>
        </div>
        <div>
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">Completed</div>
          <div className="tt-display tabular-nums text-[23px]">
            {completedCount} / {allSessions.length}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 italic text-muted-foreground">
          Loading…
        </div>
      )}

      {data && view === 'grid' && (
        <TrainingGrid
          data={data}
          onOpenSession={(date, session) =>
            setSessionModal({ open: true, session, date })
          }
        />
      )}
      {data && view === 'list' && (
        <TrainingList
          data={data}
          onOpenSession={(date, session) =>
            setSessionModal({ open: true, session, date })
          }
        />
      )}

      <SessionModal
        open={sessionModal.open}
        onClose={() => setSessionModal({ open: false, date: '' })}
        session={sessionModal.session}
        date={sessionModal.date}
      />

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        weekStart={rangeStart}
      />
      </div>
    </>
  )
}
