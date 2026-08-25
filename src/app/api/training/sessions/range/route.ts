import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  competitions,
  trainingSessions,
  type UserPreferences,
} from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import {
  expandWorkoutShortKeys,
  resolveEffectiveWorkout,
} from "@/server/services/workout-normalize";
import { trainingSessionResponse } from "@/server/serializers";
import { calculateTrimp } from "@/server/services/training-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkoutShape {
  type?: string;
  distance_km?: number | null;
  estimated_load?: number | null;
  training_phase?: string | null;
  [k: string]: unknown;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dominant<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * GET /api/training/sessions/range?start=YYYY-MM-DD&weeks=N
 *
 * Returns an array of N consecutive weeks starting from the Monday of `start`,
 * each shaped like the single-week response. Used by the multi-week grid view.
 *
 * Query params:
 *   start  — ISO date; defaults to this Monday. The route always snaps to Monday.
 *   weeks  — number of weeks to return, 1..12. Defaults to 4.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const rawStart = req.nextUrl.searchParams.get("start") ?? todayISO();
  const startMonday = mondayOfWeek(rawStart);
  const weeksParam = parseInt(req.nextUrl.searchParams.get("weeks") ?? "4", 10);
  const weeks = Math.max(1, Math.min(12, Number.isFinite(weeksParam) ? weeksParam : 4));

  const rangeStart = startMonday;
  const rangeEnd = addDaysISO(startMonday, weeks * 7 - 1);

  // Single query for the whole range
  const rows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        gte(trainingSessions.sessionDate, rangeStart),
        lte(trainingSessions.sessionDate, rangeEnd),
      ),
    )
    .orderBy(asc(trainingSessions.sessionDate));

  const activityIds = rows
    .map((r) => r.completedActivityId)
    .filter((v): v is number => typeof v === "number");
  const completedById = new Map<number, typeof activities.$inferSelect>();
  if (activityIds.length > 0) {
    const acts = await db
      .select()
      .from(activities)
      .where(inArray(activities.id, activityIds));
    for (const a of acts) completedById.set(a.id, a);
  }

  const prefs = (session.user.preferences ?? {}) as UserPreferences;
  const restingHr = prefs.resting_hr ?? 50;
  const maxHr = prefs.max_hr ?? 190;

  // Bucket sessions by week
  type SessionRow = (typeof rows)[number];
  const weekBuckets: SessionRow[][] = Array.from({ length: weeks }, () => []);
  for (const s of rows) {
    const sd = s.sessionDate as unknown as string;
    const offsetDays = Math.floor(
      (Date.parse(`${sd}T00:00:00Z`) - Date.parse(`${rangeStart}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24),
    );
    const wi = Math.floor(offsetDays / 7);
    if (wi >= 0 && wi < weeks) weekBuckets[wi].push(s);
  }

  const weeksOut = weekBuckets.map((bucketRows, wi) => {
    const weekStart = addDaysISO(rangeStart, wi * 7);
    const weekEnd = addDaysISO(weekStart, 6);

    let totalLoadPlanned = 0;
    let totalLoadActual = 0;
    let totalDistancePlanned = 0;
    let totalDistanceRecommended = 0;
    let totalDistanceFinal = 0;
    const phases: string[] = [];

    const enriched = bucketRows.map((s) => {
      const base = trainingSessionResponse(s) as ReturnType<typeof trainingSessionResponse> & {
        actual_load?: number;
        completed_activity_summary?: {
          distance_km: number;
          duration_min: number;
          avg_hr?: number;
          avg_pace?: number;
        };
      };

      if (s.completedActivityId) {
        const a = completedById.get(s.completedActivityId);
        if (a && a.avgHeartRate && a.duration) {
          const load = calculateTrimp(a.duration, a.avgHeartRate, restingHr, maxHr);
          const rounded = Math.round(load * 10) / 10;
          base.actual_load = rounded;
          totalLoadActual += rounded;
          base.completed_activity_summary = {
            distance_km: Math.round(((a.distance ?? 0) / 1000) * 100) / 100,
            duration_min: Math.round(((a.duration ?? 0) / 60) * 10) / 10,
            avg_hr: a.avgHeartRate ?? undefined,
            avg_pace: a.avgPace ?? undefined,
          };
        }
      }

      // Through resolveEffectiveWorkout so the short keys are expanded. The
      // precedence here was already right, but reading the raw jsonb was not: an
      // AI recommendation is stored as the model wrote it, with `load` and `ph`
      // rather than `estimated_load` and `training_phase`, so neither was ever
      // found and a generated week reported no planned load and no phase.
      const workout = resolveEffectiveWorkout(s) as WorkoutShape | null;
      if (workout) {
        if (typeof workout.estimated_load === "number") totalLoadPlanned += workout.estimated_load;
        if (typeof workout.training_phase === "string") phases.push(workout.training_phase);
      }

      // Each column separately — these three totals are the point, so they
      // cannot go through resolveEffectiveWorkout. They still need expanding:
      // a stored recommendation carries `km`, not `distance_km`, so reading it
      // raw reported zero recommended kilometres for every generated week.
      const planned = expandWorkoutShortKeys(s.plannedWorkout) as WorkoutShape | null;
      if (planned?.distance_km) totalDistancePlanned += planned.distance_km;
      const rec = expandWorkoutShortKeys(s.recommendationWorkout) as WorkoutShape | null;
      if (rec?.distance_km) totalDistanceRecommended += rec.distance_km;
      const fin = expandWorkoutShortKeys(s.finalWorkout) as WorkoutShape | null;
      if (fin?.distance_km) totalDistanceFinal += fin.distance_km;

      return base;
    });

    return {
      sessions: enriched,
      week_start: weekStart,
      week_end: weekEnd,
      total_distance_planned: totalDistancePlanned,
      total_distance_recommended: totalDistanceRecommended,
      total_distance_final: totalDistanceFinal,
      training_phase: dominant(phases) ?? undefined,
      total_load_planned: totalLoadPlanned > 0 ? Math.round(totalLoadPlanned * 10) / 10 : undefined,
      total_load_actual: totalLoadActual > 0 ? Math.round(totalLoadActual * 10) / 10 : undefined,
    };
  });

  // Races in view, read straight from the competitions table rather than
  // duplicated into training_sessions. One source of truth: editing a race's
  // date or deleting it is reflected here with nothing to keep in sync.
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
        gte(competitions.raceDate, rangeStart),
        lte(competitions.raceDate, rangeEnd),
      ),
    )
    .orderBy(asc(competitions.raceDate));

  return NextResponse.json({
    range_start: rangeStart,
    range_end: rangeEnd,
    weeks: weeksOut,
    races: raceRows.map((r) => ({
      id: r.id,
      name: r.name,
      date: String(r.raceDate),
      race_type: r.raceType,
      priority: r.priority,
    })),
  });
}
