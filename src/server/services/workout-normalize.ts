// Short-key expansion + effective-workout resolution, extracted from
// claude.ts so consumers that must stay free of the Anthropic SDK (the
// matching engine, Vitest suites) can import it. claude.ts re-exports
// expandShortKeys for existing callers. Deliberately NOT "server-only":
// pure data transformation, importable from tests.

import type { WorkoutDetails } from "@/lib/types";

export const TOP_KEYS: Record<string, string> = {
  a: "analysis",
  wf: "weekly_focus",
  ss: "sessions",
  w: "warnings",
};

export const SESSION_KEYS: Record<string, string> = {
  d: "date",
  t: "type",
  s: "sport",
  desc: "description",
  km: "distance_km",
  min: "duration_min",
  int: "intensity",
  hr: "hr_zone",
  pace: "pace_range",
  pw: "power_target_watts",
  ivl: "intervals",
  n: "notes",
  ph: "training_phase",
  tr: "terrain",
  el: "elevation_target_m",
  load: "estimated_load",
  rpe: "rpe_target",
  alt: "alternative_workout",
};

export const INTERVAL_KEYS: Record<string, string> = {
  r: "reps",
  dm: "distance_m",
  tp: "target_pace",
  rec: "recovery",
};

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function expandSessionKeys(session: Record<string, unknown>): Record<string, unknown> {
  const expanded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(session)) {
    const fullKey = SESSION_KEYS[k] ?? k;
    if (fullKey === "intervals" && Array.isArray(v)) {
      expanded[fullKey] = v.map((ivl) =>
        isPlainObject(ivl)
          ? Object.fromEntries(
              Object.entries(ivl).map(([ik, iv]) => [INTERVAL_KEYS[ik] ?? ik, iv]),
            )
          : ivl,
      );
    } else if (fullKey === "alternative_workout" && isPlainObject(v)) {
      expanded[fullKey] = Object.fromEntries(
        Object.entries(v).map(([ak, av]) => [SESSION_KEYS[ak] ?? ak, av]),
      );
    } else {
      expanded[fullKey] = v;
    }
  }
  return expanded;
}

/** Idempotent expansion of compressed Claude responses to full keys. */
export function expandShortKeys(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) return {} as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[TOP_KEYS[k] ?? k] = v;

  if (Array.isArray(out.sessions)) {
    out.sessions = (out.sessions as unknown[]).map((s) =>
      isPlainObject(s) ? expandSessionKeys(s) : s,
    );
  }
  return out;
}

/**
 * Idempotent expansion of a SINGLE workout object (the shape persisted in
 * training_sessions.recommendation_workout, which is stored short-key).
 */
export function expandWorkoutShortKeys(workout: unknown): WorkoutDetails | null {
  if (!isPlainObject(workout)) return null;
  return expandSessionKeys(workout) as unknown as WorkoutDetails;
}

/**
 * The workout a session effectively prescribes, mirroring the client grid's
 * displayedWorkout() precedence: final → recommendation (expanded) → planned.
 */
export function resolveEffectiveWorkout(session: {
  finalWorkout?: unknown;
  recommendationWorkout?: unknown;
  plannedWorkout?: unknown;
}): WorkoutDetails | null {
  if (isPlainObject(session.finalWorkout)) {
    return expandWorkoutShortKeys(session.finalWorkout);
  }
  if (isPlainObject(session.recommendationWorkout)) {
    return expandWorkoutShortKeys(session.recommendationWorkout);
  }
  if (isPlainObject(session.plannedWorkout)) {
    return expandWorkoutShortKeys(session.plannedWorkout);
  }
  return null;
}
