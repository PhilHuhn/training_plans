'use client'
import type { DashboardLoadPoint } from '@/lib/types'
import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStats } from '@/hooks/use-activities'
import { useCurrentUser } from '@/hooks/use-auth'
import { formatPace } from '@/lib/utils'
import { splitForChart } from '@/lib/load-series'
import { CHART_TOOLTIP_STYLE, SEQUENTIAL_RAMP, SPORT_COLORS } from '@/lib/sport-theme'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  BarChart,
  Cell,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
} from 'recharts'

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
]

const tooltipStyle = CHART_TOOLTIP_STYLE

function DeltaBadge({
  current,
  previous,
  lowerIsBetter = false,
}: {
  current: number | null
  previous: number | null
  lowerIsBetter?: boolean
}) {
  if (current == null || previous == null || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="flex items-center gap-0.5 text-xs italic text-muted-foreground">
        <Minus className="h-3 w-3" /> flat
      </span>
    )
  }
  const improved = lowerIsBetter ? pct < 0 : pct > 0
  return (
    <span
      className={`flex items-center gap-0.5 text-xs italic ${improved ? 'text-foreground' : 'text-accent'}`}
    >
      {pct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function KpiCard({
  label,
  value,
  unit,
  delta,
}: {
  label: string
  value: string
  unit?: string
  delta?: React.ReactNode
}) {
  return (
    <div className="surface-tile px-[18px] py-4">
      <p className="smallcaps text-[11.5px] italic text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="tt-display text-2xl leading-tight tabular-nums">{value}</p>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {delta}
    </div>
  )
}

function BandFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="smallcaps text-[11.5px] italic text-muted-foreground">{label}</div>
      <div className="tt-display tabular-nums text-[26px]">{value}</div>
    </div>
  )
}

// A one-line reading of the form (TSB) figure, so the band says something a
// runner can act on instead of repeating the number underneath it. Thresholds
// follow the usual Banister reading: positive form is fresh, deeply negative
// form means fatigue has run ahead of fitness.
function formHeadline(latest: DashboardLoadPoint | null): string {
  if (!latest) return 'No load data for this period yet.'
  const tsb = latest.tsb
  if (tsb > 15) return 'Well rested — fitness is drifting down.'
  if (tsb > 5) return 'Fresh. A hard session would land well.'
  if (tsb > -10) return 'Load and freshness are in balance.'
  if (tsb > -25) return 'Carrying real fatigue. Keep the easy days easy.'
  return 'Fatigue is well ahead of fitness. Back off before it costs you.'
}

/**
 * A race marker.
 *
 * Recharts injects cx/cy into whatever element is handed to ReferenceDot's
 * `shape`, so the diamond is drawn as an explicit path rather than named — the
 * library has no built-in diamond for reference dots. A-races are filled, the
 * rest hollow, so priority reads without a legend.
 */
function RaceDiamond({ cx, cy, filled }: { cx?: number; cy?: number; filled?: boolean }) {
  if (cx == null || cy == null) return null
  const r = 5
  return (
    <path
      d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
      fill={filled ? SPORT_COLORS.run : '#FAF8F2'}
      stroke={SPORT_COLORS.run}
      strokeWidth={1.5}
    />
  )
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const [days, setDays] = useState(90)
  const { data, isLoading } = useDashboardStats(days)
  const { data: user } = useCurrentUser()
  const router = useRouter()

  const load = data?.load ?? []
  const races = data?.races ?? []

  // The last *measured* day, not the last point — `load` now runs a week past
  // today, and the band beside it says "today". Reading the end of the array
  // would quietly report the forecast as fact.
  const measured = load.filter((p) => !p.projected)
  const latest = measured.length > 0 ? measured[measured.length - 1] : null
  const today = latest?.date ?? null

  // Recharts cannot dash part of a line, so the projection is a second series;
  // splitForChart writes the boundary day to both so they meet. See @/lib/load-series.
  const chartData = splitForChart(load)
  const forecastFrom = load.find((p) => p.projected)?.date ?? null
  const forecastTo = load.length > 0 ? load[load.length - 1].date : null
  const hasActivities = (data?.summary.count ?? 0) > 0

  const rangeLabel = RANGES.find((r) => r.days === days)?.label ?? `${days} days`

  return (
    <>
      {/* Opening band */}
      <div className="surface-band relative overflow-hidden border-b border-foreground/15 px-4 py-7 lg:px-7 lg:py-[34px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(90% 120% at 88% 0%, color-mix(in srgb, var(--primary) 13%, transparent), transparent 62%)',
          }}
        />
        <div className="relative z-[2] mx-auto max-w-6xl">
          <div className="smallcaps text-xs italic text-muted-foreground">
            Last {rangeLabel.toLowerCase()}
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
            <div className="tt-display max-w-[30ch] text-[28px] leading-[1.12] lg:text-[34px]">
              {formHeadline(latest)}
            </div>
            <div className="flex flex-wrap gap-8">
              {latest && (
                <>
                  <BandFigure label="Fitness" value={latest.ctl.toFixed(0)} />
                  <BandFigure label="Fatigue" value={latest.atl.toFixed(0)} />
                  <BandFigure
                    label="Form"
                    value={`${latest.tsb > 0 ? '+' : ''}${latest.tsb.toFixed(0)}`}
                  />
                </>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm italic text-muted-foreground">
              Comparisons refer to the preceding period of equal length.
            </p>
            <div className="flex gap-1.5">
              {RANGES.map((r) => (
                <Button
                  key={r.days}
                  variant={days === r.days ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 lg:px-7">

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : !hasActivities ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No activities in this period.</p>
            {!user?.strava_connected && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push('/settings')}
              >
                Connect Strava
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        data && (
          <>
            {/* KPI cards */}
            <div className="hairline-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                label="Activities"
                value={String(data.summary.count)}
                delta={<DeltaBadge current={data.summary.count} previous={data.previous.count} />}
              />
              <KpiCard
                label="Distance"
                value={data.summary.distance_km.toFixed(0)}
                unit="km"
                delta={
                  <DeltaBadge
                    current={data.summary.distance_km}
                    previous={data.previous.distance_km}
                  />
                }
              />
              <KpiCard
                label="Time"
                value={data.summary.duration_hours.toFixed(1)}
                unit="h"
                delta={
                  <DeltaBadge
                    current={data.summary.duration_hours}
                    previous={data.previous.duration_hours}
                  />
                }
              />
              <KpiCard
                label="Elevation"
                value={data.summary.elevation_m.toLocaleString()}
                unit="m"
                delta={
                  <DeltaBadge
                    current={data.summary.elevation_m}
                    previous={data.previous.elevation_m}
                  />
                }
              />
              <KpiCard
                label="Avg HR"
                value={data.summary.avg_heart_rate != null ? String(data.summary.avg_heart_rate) : '–'}
                unit="bpm"
                delta={
                  <DeltaBadge
                    current={data.summary.avg_heart_rate}
                    previous={data.previous.avg_heart_rate}
                    lowerIsBetter
                  />
                }
              />
              <KpiCard
                label="Run Pace"
                value={data.summary.avg_run_pace != null ? formatPace(data.summary.avg_run_pace).replace(' /km', '') : '–'}
                unit="/km"
                delta={
                  <DeltaBadge
                    current={data.summary.avg_run_pace}
                    previous={data.previous.avg_run_pace}
                    lowerIsBetter
                  />
                }
              />
            </div>

            {/* Fitness / Fatigue / Form */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    Training Load — Fitness (CTL), Fatigue (ATL) &amp; Form (TSB)
                  </CardTitle>
                  {latest && (
                    <p className="text-xs italic text-muted-foreground">
                      today: fitness {latest.ctl.toFixed(0)}, fatigue {latest.atl.toFixed(0)}, form{' '}
                      {latest.tsb > 0 ? '+' : ''}
                      {latest.tsb.toFixed(0)}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={formatDay}
                        minTickGap={30}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={36} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(l) => formatDay(String(l))}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: any, name: any) => {
                          const labels: Record<string, string> = {
                            ctl: 'Fitness (CTL)',
                            atl: 'Fatigue (ATL)',
                            tsb: 'Form (TSB)',
                            trimp: 'Daily TRIMP',
                          }
                          return [Number(value ?? 0).toFixed(1), labels[String(name)] ?? name]
                        }) as never}
                      />
                      <Legend
                        iconType="plainline"
                        iconSize={12}
                        wrapperStyle={{ fontSize: 11 }}
                        // Spelled out rather than inferred from the series.
                        // `legendType="none"` on the projected lines does not
                        // keep them out of this build's legend, and letting it
                        // default lists "ctl_projected" and friends — six raw
                        // field names for three metrics.
                        //
                        // The nested `payload` is required, not decoration: the
                        // plainline icon reads `entry.payload.strokeDasharray`,
                        // and a synthetic entry without it throws.
                        payload={[
                          { value: 'trimp', type: 'rect', color: '#D8D4C8', payload: { strokeDasharray: '' } },
                          { value: 'ctl', type: 'plainline', color: SPORT_COLORS.ink, payload: { strokeDasharray: '' } },
                          { value: 'atl', type: 'plainline', color: SPORT_COLORS.ride, payload: { strokeDasharray: '' } },
                          { value: 'tsb', type: 'plainline', color: SPORT_COLORS.run, payload: { strokeDasharray: '4 3' } },
                        ] as never}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: any) => {
                          const labels: Record<string, string> = {
                            ctl: 'Fitness',
                            atl: 'Fatigue',
                            tsb: 'Form',
                            trimp: 'Daily TRIMP',
                          }
                          return labels[String(value)] ?? value
                        }) as never}
                      />

                      {/* The forecast window, washed so the eye reads it as
                          "not measured yet" before reading any line style. */}
                      {forecastFrom && forecastTo && (
                        <ReferenceArea
                          x1={forecastFrom}
                          x2={forecastTo}
                          fill={SPORT_COLORS.ink}
                          fillOpacity={0.045}
                        />
                      )}
                      {today && (
                        <ReferenceLine
                          x={today}
                          stroke="#8A8A8A"
                          strokeDasharray="3 3"
                          label={{ value: 'today', position: 'insideTopLeft', fontSize: 10, fill: '#8A8A8A' }}
                        />
                      )}

                      {/* A-races get a full line; every race gets a diamond. A
                          season of C-races would otherwise stripe the chart. */}
                      {races
                        .filter((r) => r.priority === 'A')
                        .map((r) => (
                          <ReferenceLine
                            key={`line-${r.id}`}
                            x={r.date}
                            stroke={SPORT_COLORS.run}
                            strokeOpacity={0.5}
                            strokeDasharray="2 3"
                          />
                        ))}

                      <ReferenceLine y={0} stroke="#B5B5B5" strokeDasharray="2 2" />
                      <Bar dataKey="trimp" fill="#D8D4C8" name="trimp" />

                      <Line type="monotone" dataKey="ctl" stroke={SPORT_COLORS.ink} strokeWidth={2} dot={false} name="ctl" />
                      <Line type="monotone" dataKey="atl" stroke={SPORT_COLORS.ride} strokeWidth={1.5} dot={false} name="atl" />
                      <Line
                        type="monotone"
                        dataKey="tsb"
                        stroke={SPORT_COLORS.run}
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        name="tsb"
                      />

                      {/* Projected twins. Finer dots and reduced opacity keep
                          them subordinate to the measured lines — and distinct
                          from Form, which is dashed for its own reasons. */}
                      <Line type="monotone" dataKey="ctl_projected" stroke={SPORT_COLORS.ink} strokeWidth={2} strokeDasharray="1 3" strokeOpacity={0.65} dot={false} legendType="none" name="ctl_projected" />
                      <Line type="monotone" dataKey="atl_projected" stroke={SPORT_COLORS.ride} strokeWidth={1.5} strokeDasharray="1 3" strokeOpacity={0.65} dot={false} legendType="none" name="atl_projected" />
                      <Line type="monotone" dataKey="tsb_projected" stroke={SPORT_COLORS.run} strokeWidth={1.5} strokeDasharray="1 3" strokeOpacity={0.65} dot={false} legendType="none" name="tsb_projected" />

                      {/* Race diamonds, pinned to the axis so they read as dates
                          rather than as values on any one curve. */}
                      {races.map((r) => (
                        <ReferenceDot
                          key={`dot-${r.id}`}
                          x={r.date}
                          y={0}
                          shape={<RaceDiamond filled={r.priority === 'A'} />}
                          ifOverflow="extendDomain"
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs italic text-muted-foreground">
                  Banister TRIMP with 42-day (fitness) and 7-day (fatigue) exponential averages. Positive
                  form means fresh; strongly negative form indicates accumulated fatigue.
                  {forecastFrom && ' The shaded tail is a projection from your planned sessions, not a measurement — it assumes you train the plan as written.'}
                  {races.length > 0 && ' Diamonds mark races; A-races also get a vertical line.'}
                </p>
              </CardContent>
            </Card>

            {/* HR zones + pace trend */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Time in Heart-Rate Zones (h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.zone_distribution}
                        layout="vertical"
                        margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          width={110}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={((value: any) => [`${Number(value ?? 0).toFixed(1)} h`, 'Time']) as never}
                        />
                        <Bar dataKey="hours">
                          {/* Zones are ordered, so they get a sequential ramp
                              rather than the categorical sport palette. */}
                          {data.zone_distribution.map((_, i) => (
                            <Cell
                              key={i}
                              fill={SEQUENTIAL_RAMP[Math.min(i, SEQUENTIAL_RAMP.length - 1)]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Each activity is assigned to a zone by its average heart rate.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Run Pace Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.pace_trend.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No runs in this period.
                    </p>
                  ) : (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={formatDay}
                            minTickGap={30}
                          />
                          <YAxis
                            dataKey="pace"
                            reversed
                            domain={['dataMin - 10', 'dataMax + 10']}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => formatPace(Number(v)).replace(' /km', '')}
                            width={44}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={((value: any, name: any) =>
                              name === 'pace'
                                ? [formatPace(Number(value)), 'Pace']
                                : [value, name]) as never}
                            labelFormatter={() => ''}
                          />
                          <Scatter data={data.pace_trend} fill={SPORT_COLORS.run} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Average pace per run (lower is faster; y-axis inverted).
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Records */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Highlights of the Period</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {data.records.longest && (
                      <tr className="border-t border-foreground/15">
                        <td className="py-2 pr-3 italic text-muted-foreground">Longest activity</td>
                        <td className="py-2 pr-3">{data.records.longest.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {data.records.longest.distance_km?.toFixed(1)} km
                        </td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {formatDay(data.records.longest.date)}
                        </td>
                      </tr>
                    )}
                    {data.records.fastest_run_5k_plus && (
                      <tr className="border-t border-foreground/15">
                        <td className="py-2 pr-3 italic text-muted-foreground">
                          Fastest run (≥ 5 km)
                        </td>
                        <td className="py-2 pr-3">{data.records.fastest_run_5k_plus.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatPace(data.records.fastest_run_5k_plus.pace)}
                        </td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {formatDay(data.records.fastest_run_5k_plus.date)}
                        </td>
                      </tr>
                    )}
                    {data.records.most_elevation &&
                      (data.records.most_elevation.elevation_m ?? 0) > 0 && (
                        <tr className="border-t border-foreground/15">
                          <td className="py-2 pr-3 italic text-muted-foreground">Most climbing</td>
                          <td className="py-2 pr-3">{data.records.most_elevation.name}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {data.records.most_elevation.elevation_m?.toLocaleString()} m
                          </td>
                          <td className="py-2 text-right text-xs text-muted-foreground">
                            {formatDay(data.records.most_elevation.date)}
                          </td>
                        </tr>
                      )}
                    {data.records.biggest_week && (
                      <tr className="border-y border-foreground/15">
                        <td className="py-2 pr-3 italic text-muted-foreground">Biggest week</td>
                        <td className="py-2 pr-3">Week of {formatDay(data.records.biggest_week.week)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {data.records.biggest_week.distance_km.toFixed(1)} km
                        </td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )
      )}
      </div>
    </>
  )
}
