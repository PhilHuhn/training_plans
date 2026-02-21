import { useState, useMemo } from 'react'
import {
  RefreshCw,
  Zap,
  Heart,
  Link as LinkIcon,
  Bike,
  Waves,
  Dumbbell,
  Mountain,
  Ship,
  Footprints,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useActivities,
  useStatsBySport,
  useWeeklyBySport,
  useStravaSync,
} from '@/hooks/use-activities'
import { useCurrentUser } from '@/hooks/use-auth'
import {
  formatDistance,
  formatDuration,
  formatPace,
  stravaSportLabel,
  stravaSportHex,
  stravaSportColor,
  stravaSportIcon,
} from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

export default function ActivitiesPage() {
  const { data: user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const [sportFilter, setSportFilter] = useState<string | null>(null)
  const { data: sportStats, isLoading: sportStatsLoading } = useStatsBySport()
  const { data: weeklyData } = useWeeklyBySport(12)
  const { data, isLoading } = useActivities({
    page,
    per_page: 20,
    activity_type: sportFilter || undefined,
  })
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

  // Unique sports across the data for filter tabs
  const allSports = useMemo(() => {
    if (!sportStats?.sports) return []
    return sportStats.sports.map((s) => s.sport)
  }, [sportStats])

  // Build stacked bar chart data from weekly stats
  const barChartData = useMemo(() => {
    if (!weeklyData?.weeks) return []
    return weeklyData.weeks.map((w) => {
      const row: Record<string, number | string> = {
        week: w.week.slice(5), // "MM-DD" for compact labels
      }
      for (const [sport, stats] of Object.entries(w.sports)) {
        row[sport] = stats.distance_km
      }
      return row
    })
  }, [weeklyData])

  // Unique sport keys in weekly data for stacked bars
  const weeklySportKeys = useMemo(() => {
    if (!weeklyData?.weeks) return []
    const keys = new Set<string>()
    weeklyData.weeks.forEach((w) => Object.keys(w.sports).forEach((k) => keys.add(k)))
    return Array.from(keys)
  }, [weeklyData])

  // Pie chart data
  const pieData = useMemo(() => {
    if (!sportStats?.sports) return []
    return sportStats.sports.map((s) => ({
      name: stravaSportLabel(s.sport),
      value: s.count,
      color: stravaSportHex(s.sport),
    }))
  }, [sportStats])

  const sportIcon = (type: string) => {
    const iconType = stravaSportIcon(type)
    switch (iconType) {
      case 'cycling':
        return <Bike className="h-4 w-4" />
      case 'swimming':
        return <Waves className="h-4 w-4" />
      case 'strength':
        return <Dumbbell className="h-4 w-4" />
      case 'hiking':
        return <Mountain className="h-4 w-4" />
      case 'rowing':
        return <Ship className="h-4 w-4" />
      default:
        return <Footprints className="h-4 w-4" />
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

      {/* Per-Sport Summary Cards */}
      {sportStatsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : sportStats?.sports && sportStats.sports.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sportStats.sports.map((s) => (
            <Card
              key={s.sport}
              className={`cursor-pointer transition-all hover:shadow-md ${sportFilter === s.sport ? 'ring-2 ring-primary' : ''}`}
              onClick={() => {
                setSportFilter(sportFilter === s.sport ? null : s.sport)
                setPage(1)
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: stravaSportHex(s.sport) + '20', color: stravaSportHex(s.sport) }}
                >
                  {sportIcon(s.sport)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {stravaSportLabel(s.sport)}
                  </p>
                  <p className="text-lg font-semibold leading-tight">{s.count}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.distance_km > 0 ? `${s.distance_km.toFixed(0)} km` : `${s.duration_hours.toFixed(0)}h`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Charts Row */}
      {(barChartData.length > 0 || pieData.length > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Weekly Volume Stacked Bar Chart */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Weekly Distance (km) by Sport</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name: any) => [
                        `${Number(value ?? 0).toFixed(1)} km`,
                        stravaSportLabel(String(name ?? '')),
                      ]) as never}
                    />
                    {weeklySportKeys.map((sport) => (
                      <Bar
                        key={sport}
                        dataKey={sport}
                        stackId="a"
                        fill={stravaSportHex(sport)}
                        radius={[0, 0, 0, 0]}
                        name={sport}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sport Distribution Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sport Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any) => [`${value ?? 0} activities`]) as never}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sport Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={sportFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setSportFilter(null)
            setPage(1)
          }}
        >
          All
        </Button>
        {allSports.map((sport) => (
          <Button
            key={sport}
            variant={sportFilter === sport ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setSportFilter(sportFilter === sport ? null : sport)
              setPage(1)
            }}
          >
            {sportIcon(sport)}
            {stravaSportLabel(sport)}
          </Button>
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
            <p className="text-sm text-muted-foreground">
              {sportFilter ? `No ${stravaSportLabel(sportFilter)} activities.` : 'No activities yet.'}
            </p>
            {!sportFilter && (
              <p className="text-xs text-muted-foreground">
                Connect Strava and sync to see your activities here.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.activities.map((activity) => (
            <Card key={activity.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                {/* Sport icon */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: stravaSportHex(activity.activity_type) + '20',
                    color: stravaSportHex(activity.activity_type),
                  }}
                >
                  {sportIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{activity.name}</p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${stravaSportColor(activity.activity_type)}`}
                    >
                      {stravaSportLabel(activity.activity_type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.start_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {activity.distance != null && activity.distance > 0 && (
                    <span className="font-medium text-foreground">
                      {formatDistance(activity.distance)}
                    </span>
                  )}
                  {activity.duration != null && activity.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {formatDuration(activity.duration)}
                    </span>
                  )}
                  {activity.avg_pace != null && activity.avg_pace > 0 && (
                    <span>{formatPace(activity.avg_pace)}</span>
                  )}
                  {activity.avg_heart_rate != null && activity.avg_heart_rate > 0 && (
                    <span className="flex items-center gap-1 text-rose-500">
                      <Heart className="h-3 w-3" />
                      {Math.round(activity.avg_heart_rate)}
                    </span>
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
