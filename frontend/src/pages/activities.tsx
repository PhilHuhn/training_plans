import { useState } from 'react'
import { RefreshCw, Zap, MapPin, Heart, Mountain, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivities, useActivityStats, useStravaSync } from '@/hooks/use-activities'
import { useCurrentUser } from '@/hooks/use-auth'
import { formatDistance, formatDuration, formatPace } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'

export default function ActivitiesPage() {
  const { data: user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useActivities({ page, per_page: 20 })
  const { data: stats } = useActivityStats()
  const sync = useStravaSync()
  const navigate = useNavigate()

  const handleSync = () => {
    sync.mutate(90, {
      onSuccess: (result) => {
        toast.success(`Synced ${result.count} activities from Strava`)
      },
      onError: () => {
        toast.error('Failed to sync activities')
      },
    })
  }

  const statCards = [
    { label: 'Total Runs', value: stats?.total_activities ?? '-', icon: Zap, color: 'text-blue-600 bg-blue-50' },
    { label: 'Distance', value: stats ? `${stats.total_distance_km.toFixed(0)} km` : '-', icon: MapPin, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Avg HR', value: stats?.avg_heart_rate ? `${Math.round(stats.avg_heart_rate)} bpm` : '-', icon: Heart, color: 'text-red-600 bg-red-50' },
    { label: 'Elevation', value: stats ? `${Math.round(stats.total_elevation_m)} m` : '-', icon: Mountain, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        {user?.strava_connected ? (
          <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />
            {sync.isPending ? 'Syncing...' : 'Sync from Strava'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
            <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
            Connect Strava
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data?.activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No activities yet.</p>
            <p className="text-xs text-muted-foreground">Connect Strava and sync to see your runs here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.activities.map((activity) => (
            <Card key={activity.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.start_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {activity.distance && (
                    <span className="font-medium text-foreground">
                      {formatDistance(activity.distance)}
                    </span>
                  )}
                  {activity.duration && <span>{formatDuration(activity.duration)}</span>}
                  {activity.avg_pace && <span>{formatPace(activity.avg_pace)}</span>}
                  {activity.avg_heart_rate && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(activity.avg_heart_rate)} bpm
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {data && data.total > data.per_page && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(data.total / data.per_page)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / data.per_page)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
