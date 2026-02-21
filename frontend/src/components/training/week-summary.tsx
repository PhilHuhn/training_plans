import { Calendar, Sparkles, CheckCircle } from 'lucide-react'
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

  const cards = [
    {
      label: 'Planned',
      value: `${planned.toFixed(1)} km`,
      icon: Calendar,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'AI Recommended',
      value: `${recommended.toFixed(1)} km`,
      icon: Sparkles,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Final Plan',
      value: `${finalTotal.toFixed(1)} km`,
      icon: CheckCircle,
      color: 'text-emerald-600 bg-emerald-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
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
