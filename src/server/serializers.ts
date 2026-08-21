import "server-only";
import type {
  Activity,
  Competition,
  TrainingSession,
} from "@/server/db/schema";

const isoOrNull = (d: Date | null | undefined): string | null =>
  d instanceof Date ? d.toISOString() : null;

const isoStrict = (d: Date): string => d.toISOString();

const dateOnly = (d: Date | string): string =>
  typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);

export function activityResponse(a: Activity) {
  return {
    id: a.id,
    strava_id: a.stravaId ?? undefined,
    name: a.name,
    activity_type: a.activityType,
    description: a.description ?? undefined,
    distance: a.distance ?? undefined,
    duration: a.duration ?? undefined,
    elevation_gain: a.elevationGain ?? undefined,
    calories: a.calories ?? undefined,
    avg_heart_rate: a.avgHeartRate ?? undefined,
    max_heart_rate: a.maxHeartRate ?? undefined,
    avg_pace: a.avgPace ?? undefined,
    start_date: isoStrict(a.startDate),
    start_date_local: isoOrNull(a.startDateLocal) ?? undefined,
  };
}

export function competitionResponse(c: Competition) {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const raceDateUtc = (() => {
    const [y, m, d] = dateOnly(c.raceDate as unknown as string).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  })();
  const daysUntil = Math.round((raceDateUtc - todayUtc) / (24 * 60 * 60 * 1000));

  return {
    id: c.id,
    name: c.name,
    race_type: c.raceType,
    race_date: dateOnly(c.raceDate as unknown as string),
    distance: c.distance ?? undefined,
    elevation_gain: c.elevationGain ?? undefined,
    location: c.location ?? undefined,
    goal_time: c.goalTime ?? undefined,
    goal_pace: c.goalPace ?? undefined,
    priority: c.priority,
    notes: c.notes ?? undefined,
    created_at: isoStrict(c.createdAt),
    updated_at: isoStrict(c.updatedAt),
    days_until: daysUntil,
  };
}

export function trainingSessionResponse(s: TrainingSession) {
  return {
    id: s.id,
    session_date: dateOnly(s.sessionDate as unknown as string),
    source: s.source,
    status: s.status,
    planned_workout: s.plannedWorkout ?? undefined,
    recommendation_workout: s.recommendationWorkout ?? undefined,
    final_workout: s.finalWorkout ?? undefined,
    accepted_source: s.acceptedSource ?? undefined,
    completed_activity_id: s.completedActivityId ?? undefined,
    rpe_actual: s.rpeActual ?? undefined,
    flex_days: s.flexDays ?? 0,
    notes: s.notes ?? undefined,
    created_at: isoStrict(s.createdAt),
    updated_at: isoStrict(s.updatedAt),
  };
}
