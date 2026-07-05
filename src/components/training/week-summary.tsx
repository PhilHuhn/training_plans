'use client'
import { Calendar, Sparkles, CheckCircle, Activity } from 'lucide-react'
import type { TrainingWeekResponse } from '@/lib/types'

interface WeekSummaryProps {
  data?: TrainingWeekResponse
}

export default function WeekSummary({ data }: WeekSummaryProps) {
  const planned = data?.total_distance_planned ?? 0
  const recommended = data?.total_distance_recommended ?? 0

  // Calculate final total from sessions with final_workout
  const finalTotal =
    data?.sessions.reduce((sum, s) => {
      return sum + (s.final_workout?.distance_km ?? 0)
    }, 0) ?? 0

  const loadPlanned = data?.total_load_planned ?? 0
  const loadActual = data?.total_load_actual ?? 0
  const loadDisplay = loadActual > 0
    ? `${loadActual.toFixed(0)} / ${loadPlanned.toFixed(0)}`
    : loadPlanned > 0
      ? `${loadPlanned.toFixed(0)}`
      : '-'

  const cards = [
    {
      label: 'Planned',
      value: `${planned.toFixed(1)} km`,
      icon: Calendar,
    },
    {
      label: 'AI Recommended',
      value: `${recommended.toFixed(1)} km`,
      icon: Sparkles,
    },
    {
      label: 'Final Plan',
      value: `${finalTotal.toFixed(1)} km`,
      icon: CheckCircle,
    },
    {
      label: 'Training Load',
      value: loadDisplay,
      icon: Activity,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 border-y border-foreground/30 py-3">
      {cards.map((c) => (
        <div key={c.label} className="flex items-center gap-3">
          <c.icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs italic smallcaps text-muted-foreground">{c.label}</p>
            <p className="text-lg font-serif tabular-nums">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}