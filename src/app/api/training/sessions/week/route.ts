import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, trainingSessions, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
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

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const weekStart = req.nextUrl.searchParams.get("week_start") ?? mondayOfWeek(todayISO());
  const weekEnd = addDaysISO(weekStart, 6);

  const rows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        gte(trainingSessions.sessionDate, weekStart),
        lte(trainingSessions.sessionDate, weekEnd),
      ),
    )
    .orderBy(asc(trainingSessions.sessionDate));

  // Pull completed-activity rows for any session that has one
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

  let totalLoadPlanned = 0;
  let totalLoadActual = 0;
  let totalDistancePlanned = 0;
  let totalDistanceRecommended = 0;
  const phases: string[] = [];

  const enriched = rows.map((s) => {
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

    const workout = (s.finalWorkout ?? s.recommendationWorkout ?? s.plannedWorkout ?? null) as WorkoutShape | null;
    if (workout) {
      if (typeof workout.estimated_load === "number") totalLoadPlanned += workout.estimated_load;
      if (typeof workout.training_phase === "string") phases.push(workout.training_phase);
    }

    const planned = s.plannedWorkout as WorkoutShape | null;
    if (planned?.distance_km) totalDistancePlanned += planned.distance_km;
    const rec = s.recommendationWorkout as WorkoutShape | null;
    if (rec?.distance_km) totalDistanceRecommended += rec.distance_km;

    return base;
  });

  return NextResponse.json({
    sessions: enriched,
    week_start: weekStart,
    week_end: weekEnd,
    total_distance_planned: totalDistancePlanned,
    total_distance_recommended: totalDistanceRecommended,
    training_phase: dominant(phases) ?? undefined,
    total_load_planned: totalLoadPlanned > 0 ? Math.round(totalLoadPlanned * 10) / 10 : undefined,
    total_load_actual: totalLoadActual > 0 ? Math.round(totalLoadActual * 10) / 10 : undefined,
  });
}
