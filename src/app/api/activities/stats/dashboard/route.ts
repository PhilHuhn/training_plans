import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, competitions, trainingSessions } from "@/server/db/schema";
import type { UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { buildLoadSeries, isoDay } from "@/lib/load-series";
import { calculateTrimp, estimatePlannedLoad } from "@/server/services/training-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
// CTL uses a 42-day exponential decay; seed it with data from before the
// requested window so the curve doesn't start at zero.
const CTL_WARMUP_DAYS = 42;
// How far past today the curve is projected from planned sessions.
const FORECAST_DAYS = 7;
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

/**
 * The load a planned session is expected to cost.
 *
 * The generator writes `estimated_load` onto the workout, so prefer it. When it
 * is absent — a manually added session, or an imported plan the model left
 * unscored — fall back to estimatePlannedLoad(), which infers from duration and
 * zone or intensity.
 */
function plannedLoadOf(workout: unknown, prefs: UserPreferences | null): number {
  if (!workout || typeof workout !== "object" || Array.isArray(workout)) return 0;
  const w = workout as Record<string, unknown>;

  if (typeof w.estimated_load === "number" && w.estimated_load > 0) return w.estimated_load;

  return estimatePlannedLoad(
    typeof w.duration_min === "number" ? w.duration_min : null,
    typeof w.intensity === "string" ? w.intensity : null,
    typeof w.hr_zone === "string" ? w.hr_zone : null,
    prefs?.resting_hr ?? null,
    prefs?.max_hr ?? null,
    prefs,
  );
}

interface ActivityRow {
  id: number;
  name: string;
  activityType: string | null;
  distance: number | null;
  duration: number | null;
  elevationGain: number | null;
  avgHeartRate: number | null;
  avgPace: number | null;
  startDate: Date;
}

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return isoDay(d);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function periodSummary(rows: ActivityRow[]) {
  let distance = 0;
  let duration = 0;
  let elevation = 0;
  let hrSum = 0;
  let hrCount = 0;
  let runPaceWeighted = 0;
  let runDistance = 0;
  for (const a of rows) {
    distance += (a.distance ?? 0) / 1000;
    duration += (a.duration ?? 0) / 3600;
    elevation += a.elevationGain ?? 0;
    if (a.avgHeartRate) {
      hrSum += a.avgHeartRate;
      hrCount += 1;
    }
    if (RUN_TYPES.has(a.activityType ?? "") && a.avgPace && a.distance) {
      runPaceWeighted += a.avgPace * (a.distance / 1000);
      runDistance += a.distance / 1000;
    }
  }
  return {
    count: rows.length,
    distance_km: round1(distance),
    duration_hours: round1(duration),
    elevation_m: Math.round(elevation),
    avg_heart_rate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    avg_run_pace: runDistance > 0 ? Math.round(runPaceWeighted / runDistance) : null,
  };
}

function zoneDistribution(rows: ActivityRow[], prefs: UserPreferences | null) {
  const zones = prefs?.hr_zones;
  if (!zones) return [];
  const entries = Object.entries(zones).sort(([, a], [, b]) => a.min - b.min);
  const hours = new Map<string, number>(entries.map(([key]) => [key, 0]));
  for (const a of rows) {
    if (!a.avgHeartRate || !a.duration) continue;
    // Classify the whole activity by its average HR: coarse, but honest about
    // what the data supports (we don't have full HR streams for every activity).
    let matched: string | null = null;
    for (const [key, range] of entries) {
      if (a.avgHeartRate <= range.max) {
        matched = key;
        break;
      }
    }
    if (!matched) matched = entries[entries.length - 1][0];
    hours.set(matched, (hours.get(matched) ?? 0) + a.duration / 3600);
  }
  return entries.map(([key, range]) => ({
    zone: key,
    name: range.name ?? key,
    min: range.min,
    max: range.max,
    hours: round1(hours.get(key) ?? 0),
  }));
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10) || 90;
  const days = Math.max(7, Math.min(730, daysParam));

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * DAY_MS);
  const prevStart = new Date(now.getTime() - 2 * days * DAY_MS);
  const fetchStart = new Date(prevStart.getTime() - CTL_WARMUP_DAYS * DAY_MS);

  const rows: ActivityRow[] = await db
    .select({
      id: activities.id,
      name: activities.name,
      activityType: activities.activityType,
      distance: activities.distance,
      duration: activities.duration,
      elevationGain: activities.elevationGain,
      avgHeartRate: activities.avgHeartRate,
      avgPace: activities.avgPace,
      startDate: activities.startDate,
    })
    .from(activities)
    .where(and(eq(activities.userId, session.user.id), gte(activities.startDate, fetchStart)))
    .orderBy(asc(activities.startDate));

  const prefs = (session.user.preferences ?? null) as UserPreferences | null;
  const maxHr = prefs?.max_hr ?? null;
  const restingHr = prefs?.resting_hr ?? null;

  const inPeriod = rows.filter((a) => a.startDate >= periodStart);
  const inPrevPeriod = rows.filter((a) => a.startDate >= prevStart && a.startDate < periodStart);

  // --- Daily TRIMP + Banister fitness/fatigue/form ---------------------------
  const trimpByDay = new Map<string, number>();
  for (const a of rows) {
    const t = calculateTrimp(a.duration, a.avgHeartRate, restingHr, maxHr);
    if (t <= 0) continue;
    const day = isoDay(a.startDate);
    trimpByDay.set(day, (trimpByDay.get(day) ?? 0) + t);
  }

  // --- Forecast: fold the next week's planned sessions into the same map ------
  //
  // The curve past today is the plan, not a measurement. Folding it into the
  // same daily-TRIMP map means one decay implementation covers both halves, so
  // the forecast continues the history rather than restating it slightly
  // differently.
  //
  // "Today" here is the server's UTC day, and `session_date` is a zoneless SQL
  // date, so the two agree for an athlete on UTC. East of it they diverge for
  // the last hours of the local evening — an athlete at UTC+2 hovering at 22:30
  // local is already on tomorrow's date, so their tomorrow gets treated as
  // today: its planned load is skipped by the guard below and the "today"
  // marker sits a day left. It corrects itself at midnight UTC. Fixing it
  // properly means the client sending its own date, which is a wider change
  // than this window justifies.
  const forecastStart = new Date(`${isoDay(now)}T00:00:00.000Z`);
  const forecastEnd = new Date(forecastStart.getTime() + FORECAST_DAYS * DAY_MS);

  const planned = await db
    .select({
      sessionDate: trainingSessions.sessionDate,
      plannedWorkout: trainingSessions.plannedWorkout,
      recommendationWorkout: trainingSessions.recommendationWorkout,
      finalWorkout: trainingSessions.finalWorkout,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        gte(trainingSessions.sessionDate, isoDay(forecastStart)),
        lte(trainingSessions.sessionDate, isoDay(forecastEnd)),
      ),
    );

  for (const s of planned) {
    const day = String(s.sessionDate);
    // Today is already counted from whatever was actually done, so adding the
    // plan on top would double it.
    if (day <= isoDay(now)) continue;
    // final → recommendation → planned, matching displayedWorkout() in
    // training-grid.tsx and the load totals in sessions/range and sessions/week.
    // The order is not cosmetic: saveRecommendations() updates only
    // recommendationWorkout and leaves plannedWorkout in place, so a session
    // that has been through "AI Plan" carries both. Reading planned first
    // projects the un-adapted plan while the calendar shows the adapted one.
    const workout = s.finalWorkout ?? s.recommendationWorkout ?? s.plannedWorkout;
    const load = plannedLoadOf(workout, prefs);
    if (load > 0) trimpByDay.set(day, (trimpByDay.get(day) ?? 0) + load);
  }

  const load = buildLoadSeries({
    trimpByDay,
    computeFrom: fetchStart,
    emitFrom: periodStart,
    emitTo: forecastEnd,
    // Tomorrow onward is projection; today is still measurement.
    projectFrom: new Date(forecastStart.getTime() + DAY_MS),
  });

  // --- Races in the charted window -------------------------------------------
  const raceRows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      raceDate: competitions.raceDate,
      raceType: competitions.raceType,
      priority: competitions.priority,
    })
    .from(competitions)
    .where(
      and(
        eq(competitions.userId, session.user.id),
        gte(competitions.raceDate, isoDay(periodStart)),
        lte(competitions.raceDate, isoDay(forecastEnd)),
      ),
    )
    .orderBy(asc(competitions.raceDate));

  const races = raceRows.map((r) => ({
    id: r.id,
    name: r.name,
    date: String(r.raceDate),
    race_type: r.raceType,
    priority: r.priority,
  }));

  // --- Pace trend (runs in period) -------------------------------------------
  const paceTrend = inPeriod
    .filter((a) => RUN_TYPES.has(a.activityType ?? "") && a.avgPace && a.distance && a.distance >= 1000)
    .map((a) => ({
      date: isoDay(a.startDate),
      pace: Math.round(a.avgPace!),
      distance_km: round1(a.distance! / 1000),
      avg_hr: a.avgHeartRate ? Math.round(a.avgHeartRate) : null,
      name: a.name,
    }));

  // --- Records over the whole fetched range (period-only for biggest week) ---
  const weeklyKm = new Map<string, number>();
  for (const a of inPeriod) {
    const wk = mondayOf(a.startDate);
    weeklyKm.set(wk, (weeklyKm.get(wk) ?? 0) + (a.distance ?? 0) / 1000);
  }
  let biggestWeek: { week: string; distance_km: number } | null = null;
  for (const [week, km] of weeklyKm) {
    if (!biggestWeek || km > biggestWeek.distance_km) {
      biggestWeek = { week, distance_km: round1(km) };
    }
  }

  const pickBest = (
    candidates: ActivityRow[],
    better: (a: ActivityRow, b: ActivityRow) => boolean,
  ): ActivityRow | null => candidates.reduce<ActivityRow | null>((best, a) => (!best || better(a, best) ? a : best), null);

  const longest = pickBest(inPeriod, (a, b) => (a.distance ?? 0) > (b.distance ?? 0));
  const mostClimb = pickBest(inPeriod, (a, b) => (a.elevationGain ?? 0) > (b.elevationGain ?? 0));
  const fastestRun = pickBest(
    inPeriod.filter((a) => RUN_TYPES.has(a.activityType ?? "") && a.avgPace && (a.distance ?? 0) >= 5000),
    (a, b) => a.avgPace! < b.avgPace!,
  );

  const toRecord = (a: ActivityRow | null) =>
    a
      ? {
          id: a.id,
          name: a.name,
          date: isoDay(a.startDate),
          distance_km: a.distance != null ? round1(a.distance / 1000) : null,
          elevation_m: a.elevationGain != null ? Math.round(a.elevationGain) : null,
          pace: a.avgPace != null ? Math.round(a.avgPace) : null,
        }
      : null;

  return NextResponse.json({
    days,
    forecast_days: FORECAST_DAYS,
    summary: periodSummary(inPeriod),
    previous: periodSummary(inPrevPeriod),
    load,
    races,
    zone_distribution: zoneDistribution(inPeriod, prefs),
    pace_trend: paceTrend,
    records: {
      longest: toRecord(longest),
      most_elevation: toRecord(mostClimb),
      fastest_run_5k_plus: toRecord(fastestRun),
      biggest_week: biggestWeek,
    },
  });
}
