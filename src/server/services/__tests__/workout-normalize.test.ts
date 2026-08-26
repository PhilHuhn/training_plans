import { describe, expect, it } from "vitest";
import { expandWorkoutShortKeys, resolveEffectiveWorkout } from "../workout-normalize";

/**
 * These two functions are the single point where a stored workout becomes
 * readable, and six call sites now depend on them: the calendar's weekly
 * totals (range + week), the dashboard forecast, the Garmin .fit export, the
 * coach's session tool, and the engine's RPE summary. Every one of those had
 * hand-rolled the logic and got it wrong in one of two ways — the wrong
 * precedence, or reading long keys off a recommendation stored in short-key
 * form. Hence the coverage.
 */

/** A recommendation exactly as the model emits it and saveRecommendations stores it. */
const SHORT_KEY_RECOMMENDATION = {
  d: "2026-08-27",
  t: "interval",
  s: "running",
  desc: "6x1200m",
  km: 16,
  min: 85,
  int: "high",
  load: 175,
  ph: "build",
  rpe: 8,
  ivl: [{ r: 6, dm: 1200, tp: "3:40", rec: "90s jog" }],
};

describe("expandWorkoutShortKeys", () => {
  it("expands the keys the load and distance totals actually read", () => {
    const w = expandWorkoutShortKeys(SHORT_KEY_RECOMMENDATION);
    expect(w).toMatchObject({
      type: "interval",
      distance_km: 16,
      duration_min: 85,
      estimated_load: 175,
      training_phase: "build",
      rpe_target: 8,
    });
  });

  it("expands interval keys, which the FIT export needs to build steps", () => {
    const w = expandWorkoutShortKeys(SHORT_KEY_RECOMMENDATION);
    expect(w?.intervals?.[0]).toMatchObject({ reps: 6, distance_m: 1200 });
  });

  it("leaves an already-long-key workout alone", () => {
    // Uploaded plans and manual entries are stored expanded already; passing
    // them through must be a no-op, not a second translation.
    const planned = { type: "easy", distance_km: 10, duration_min: 55, estimated_load: 60 };
    expect(expandWorkoutShortKeys(planned)).toMatchObject(planned);
  });

  it("returns null for a non-object", () => {
    expect(expandWorkoutShortKeys(null)).toBeNull();
    expect(expandWorkoutShortKeys(undefined)).toBeNull();
    expect(expandWorkoutShortKeys("nope")).toBeNull();
    expect(expandWorkoutShortKeys([1, 2])).toBeNull();
  });
});

describe("resolveEffectiveWorkout", () => {
  const planned = { type: "easy", distance_km: 10, duration_min: 55, estimated_load: 60 };
  const final = { type: "tempo", distance_km: 12, duration_min: 60, estimated_load: 90 };

  it("prefers the recommendation over the plan", () => {
    // The case that matters: saveRecommendations sets recommendationWorkout and
    // leaves plannedWorkout in place, so a session that has been through
    // "AI Plan" carries both. Reading planned first shows the un-adapted plan.
    const w = resolveEffectiveWorkout({
      plannedWorkout: planned,
      recommendationWorkout: SHORT_KEY_RECOMMENDATION,
    });
    expect(w).toMatchObject({ type: "interval", estimated_load: 175 });
  });

  it("prefers an accepted final workout over everything", () => {
    const w = resolveEffectiveWorkout({
      finalWorkout: final,
      recommendationWorkout: SHORT_KEY_RECOMMENDATION,
      plannedWorkout: planned,
    });
    expect(w).toMatchObject({ type: "tempo", estimated_load: 90 });
  });

  it("falls back to the plan when there is no recommendation", () => {
    expect(resolveEffectiveWorkout({ plannedWorkout: planned })).toMatchObject({ type: "easy" });
  });

  it("expands on the way out, whichever slot it came from", () => {
    // Returning the raw jsonb is the bug this function exists to prevent: a
    // caller looking for `estimated_load` finds nothing on a `load` workout and
    // treats the session as a rest day.
    const w = resolveEffectiveWorkout({ recommendationWorkout: SHORT_KEY_RECOMMENDATION });
    expect(w?.estimated_load).toBe(175);
    // The short key must not survive alongside its expansion.
    expect((w as unknown as Record<string, unknown>).load).toBeUndefined();
  });

  it("returns null when the session has no workout at all", () => {
    expect(resolveEffectiveWorkout({})).toBeNull();
    expect(
      resolveEffectiveWorkout({
        finalWorkout: null,
        recommendationWorkout: null,
        plannedWorkout: null,
      }),
    ).toBeNull();
  });

  it("skips a slot holding a non-object rather than returning it", () => {
    expect(
      resolveEffectiveWorkout({ finalWorkout: "corrupt", plannedWorkout: planned }),
    ).toMatchObject({ type: "easy" });
  });
});
