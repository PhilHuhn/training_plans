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
import { useTrainingRange } from '@/hooks/use-training'
import { getWeekStart, addDays, formatDateShort } from '@/lib/utils'
import type { TrainingSession } from '@/lib/types'

const DEFAULT_WEEKS = 4

type ViewMode = 'grid' | 'list'
const VIEW_STORAGE_KEY = 'training-view-mode'

export default function TrainingPage() {
  const router = useRouter()
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Header: range navigation + AI plan */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftRange(-rangeWeeks)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftRange(rangeWeeks)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm italic text-muted-foreground">
            {formatDateShort(rangeStart)} — {formatDateShort(rangeEnd)}
          </span>
        </div>

        <div className="flex items-center gap-3">
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
          <div className="flex border border-foreground/20">
            {[4, 6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRangeWeeks(n)}
                className={
                  n === rangeWeeks
                    ? 'border-r border-foreground/20 bg-foreground/10 px-2 py-1 text-xs last:border-r-0'
                    : 'border-r border-foreground/20 bg-transparent px-2 py-1 text-xs text-muted-foreground last:border-r-0 hover:text-foreground'
                }
                aria-pressed={n === rangeWeeks}
              >
                {n}w
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-violet-500" />
            AI Plan
          </Button>
        </div>
      </div>

      {/* Range totals strip */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-y border-foreground/15 py-2">
        <div>
          <span className="text-[10px] italic smallcaps text-muted-foreground">Range</span>
          <span className="ml-2 text-base font-serif tabular-nums">{rangeWeeks} weeks</span>
        </div>
        <div>
          <span className="text-[10px] italic smallcaps text-muted-foreground">Total km</span>
          <span className="ml-2 text-base font-serif tabular-nums">{totalKm.toFixed(0)} km</span>
        </div>
        {totalLoad > 0 && (
          <div>
            <span className="text-[10px] italic smallcaps text-muted-foreground">
              Planned TRIMP
            </span>
            <span className="ml-2 text-base font-serif tabular-nums">{totalLoad.toFixed(0)}</span>
          </div>
        )}
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
  )
}
