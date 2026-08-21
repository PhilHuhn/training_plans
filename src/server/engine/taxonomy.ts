// Maps the app's existing workout vocabulary (type: easy|tempo|interval|
// long_run|recovery|rest|cross_training, hr_zone: zone1..zone5) onto the
// engine's compatibility classes. No parallel enum is introduced.

import type { WorkoutDetails } from "@/lib/types";
import type { CompatClass } from "./types";

const TYPE_MAP: Record<string, CompatClass> = {
  recovery: "recovery_easy",
  easy: "recovery_easy",
  long_run: "long",
  long: "long",
  tempo: "threshold_tempo",
  threshold: "threshold_tempo",
  interval: "intervals",
  intervals: "intervals",
  cross_training: "strength_cross",
  strength: "strength_cross",
  cross: "strength_cross",
  rest: "rest_race",
  race: "rest_race",
};

/** Classes whose classification an explicit hr_zone may override. */
const HR_OVERRIDABLE: ReadonlySet<CompatClass> = new Set([
  "recovery_easy",
  "threshold_tempo",
]);

function classFromHrZone(hrZone: string | undefined): CompatClass | null {
  const m = hrZone?.match(/^zone([1-6])$/i);
  if (!m) return null;
  const z = Number(m[1]);
  if (z <= 2) return "recovery_easy";
  if (z <= 4) return "threshold_tempo";
  return "intervals";
}

/**
 * Classify a workout into its compatibility class, or null when it cannot be
 * classified (unknown type without an hr_zone) — unclassifiable sessions are
 * simply never matched.
 *
 * Pinned behavior: an explicit hr_zone overrides an ambiguous easy/tempo type
 * (e.g. type "easy" with hr_zone "zone3" classifies as threshold_tempo — the
 * physiological zone is the stimulus, not the label). Structural types
 * (long_run, interval, cross_training, rest) always win over hr_zone.
 */
export function classifyWorkout(
  workout: WorkoutDetails,
  opts?: { isRace?: boolean },
): CompatClass | null {
  if (opts?.isRace) return "rest_race";

  const byType = TYPE_MAP[(workout.type ?? "").trim().toLowerCase()] ?? null;
  const byHr = classFromHrZone(workout.hr_zone);

  if (byType && HR_OVERRIDABLE.has(byType) && byHr) return byHr;
  if (byType) return byType;
  return byHr;
}
