import { Calendar, Sparkles, CheckCircle, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
      color: 'text-[#092B37] bg-[#DBEAFE]',
    },
    {
      label: 'AI Recommended',
      value: `${recommended.toFixed(1)} km`,
      icon: Sparkles,
      color: 'text-[#092B37] bg-[#EDE9FE]',
    },
    {
      label: 'Final Plan',
      value: `${finalTotal.toFixed(1)} km`,
      icon: CheckCircle,
      color: 'text-[#092B37] bg-[#D1FAE5]',
    },
    {
      label: 'Training Load',
      value: loadDisplay,
      icon: Activity,
      color: 'text-[#092B37] bg-[#FCD34D]',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-none border-2 border-[#092B37] ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
