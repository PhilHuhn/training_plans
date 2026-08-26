'use client'
import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, Zap, Heart, Link as LinkIcon, Timer } from 'lucide-react'
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
import { formatDistance, formatDuration, formatPace, stravaSportColor } from '@/lib/utils'
import { CHART_TOOLTIP_STYLE, sportTheme } from '@/lib/sport-theme'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
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

/** Which measure the weekly stacked bars show. Both ship in the same payload. */
type WeeklyMetric = 'distance' | 'time'

const METRIC_STORAGE_KEY = 'activities-weekly-metric'

const METRIC_LABEL: Record<WeeklyMetric, string> = {
  distance: 'Distance (km)',
  time: 'Time (h)',
}

const METRIC_UNIT: Record<WeeklyMetric, string> = {
  distance: 'km',
  time: 'h',
}


export default function ActivitiesPage() {
  const { data: user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const [sportFilter, setSportFilter] = useState<string | null>(null)
  // Which measure the weekly bars show. Persisted per browser, the same way the
  // training page remembers grid vs list.
  const [metric, setMetric] = useState<WeeklyMetric>('distance')
  useEffect(() => {
    const stored = window.localStorage.getItem(METRIC_STORAGE_KEY)
    if (stored === 'distance' || stored === 'time') setMetric(stored)
  }, [])
  const changeMetric = (m: WeeklyMetric) => {
    setMetric(m)
    window.localStorage.setItem(METRIC_STORAGE_KEY, m)
  }

  const { data: sportStats, isLoading: sportStatsLoading } = useStatsBySport()
  const { data: weeklyData } = useWeeklyBySport(12)
  const { data, isLoading } = useActivities({
    page,
    per_page: 20,
    activity_type: sportFilter || undefined,
  })
  const sync = useStravaSync()
  const router = useRouter()

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

  // Build stacked bar chart data from weekly stats. Both metrics already come
  // down in the same payload, so switching is a client concern — no refetch.
  const barChartData = useMemo(() => {
    if (!weeklyData?.weeks) return []
    return weeklyData.weeks.map((w) => {
      const row: Record<string, number | string> = {
        week: w.week.slice(5), // "MM-DD" for compact labels
      }
      for (const [sport, stats] of Object.entries(w.sports)) {
        row[sport] = metric === 'distance' ? stats.distance_km : stats.duration_hours
      }
      return row
    })
  }, [weeklyData, metric])

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
    return sportStats.sports.map((s) => {
      const theme = sportTheme(s.sport)
      return { name: theme.label, value: s.count, color: theme.color }
    })
  }, [sportStats])

  // Icon and tint both come from @/lib/sport-theme, so a sport reads the same
  // in the summary tiles, the filter tabs, the list rows and the charts.
  const sportIcon = (type: string, tinted = true) => {
    const { Icon, color } = sportTheme(type)
    return <Icon className="h-4 w-4" style={tinted ? { color } : undefined} />
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
          <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
            <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
            Connect Strava
          </Button>
        )}
      </div>

      {/* Per-Sport Summary Cards */}
      {sportStatsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : sportStats?.sports && sportStats.sports.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sportStats.sports.map((s) => (
            <Card
              key={s.sport}
              className={`cursor-pointer transition-colors ${sportFilter === s.sport ? 'border-y-2 border-foreground' : ''}`}
              onClick={() => {
                setSportFilter(sportFilter === s.sport ? null : s.sport)
                setPage(1)
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center text-foreground">
                  {sportIcon(s.sport)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {sportTheme(s.sport).label}
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
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  Weekly {METRIC_LABEL[metric]} by Sport
                </CardTitle>
                <fieldset className="flex items-center gap-3 text-xs">
                  <legend className="sr-only">Weekly chart measure</legend>
                  {(
                    [
                      { value: 'distance', label: 'Distance' },
                      { value: 'time', label: 'Time' },
                    ] as { value: WeeklyMetric; label: string }[]
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className={
                        metric === value
                          ? 'flex cursor-pointer items-center gap-1.5 text-foreground'
                          : 'flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground'
                      }
                    >
                      <input
                        type="radio"
                        name="weekly-metric"
                        value={value}
                        checked={metric === value}
                        onChange={() => changeMetric(value)}
                        className="h-3 w-3 accent-foreground"
                      />
                      <span className="italic smallcaps">{label}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name: any) => [
                        `${Number(value ?? 0).toFixed(1)} ${METRIC_UNIT[metric]}`,
                        sportTheme(String(name ?? '')).label,
                      ]) as never}
                    />
                    {weeklySportKeys.map((sport) => (
                      <Bar
                        key={sport}
                        dataKey={sport}
                        stackId="a"
                        fill={sportTheme(sport).color}
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
                      contentStyle={CHART_TOOLTIP_STYLE}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any) => [`${value ?? 0} activities`]) as never}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="square"
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
            {sportIcon(sport, sportFilter !== sport)}
            {sportTheme(sport).label}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : data?.activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {sportFilter ? `No ${sportTheme(sportFilter).label} activities.` : 'No activities yet.'}
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
            <Card key={activity.id}>
              <CardContent className="flex items-center gap-4 p-4">
                {/* Sport icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground">
                  {sportIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{activity.name}</p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${stravaSportColor(activity.activity_type)}`}
                    >
                      {sportTheme(activity.activity_type).label}
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
