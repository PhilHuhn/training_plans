import { describe, expect, it } from "vitest";
import { expandWorkoutShortKeys } from "@/server/services/workout-normalize";
import { classifyWorkout } from "../taxonomy";
import type { WorkoutDetails } from "@/lib/types";

const w = (over: Partial<WorkoutDetails>): WorkoutDetails => ({
  type: "easy",
  description: "",
  ...over,
});

describe("classifyWorkout", () => {
  it("maps every existing type vocabulary value", () => {
    expect(classifyWorkout(w({ type: "easy" }))).toBe("recovery_easy");
    expect(classifyWorkout(w({ type: "recovery" }))).toBe("recovery_easy");
    expect(classifyWorkout(w({ type: "tempo" }))).toBe("threshold_tempo");
    expect(classifyWorkout(w({ type: "interval" }))).toBe("intervals");
    expect(classifyWorkout(w({ type: "long_run" }))).toBe("long");
    expect(classifyWorkout(w({ type: "cross_training" }))).toBe("strength_cross");
    expect(classifyWorkout(w({ type: "rest" }))).toBe("rest_race");
    expect(classifyWorkout(w({ type: "race" }))).toBe("rest_race");
  });

  it("is case/whitespace tolerant", () => {
    expect(classifyWorkout(w({ type: " Easy " }))).toBe("recovery_easy");
    expect(classifyWorkout(w({ type: "TEMPO" }))).toBe("threshold_tempo");
  });

  it("pins: hr_zone overrides ambiguous easy/tempo types", () => {
    // The physiological zone is the stimulus, not the label.
    expect(classifyWorkout(w({ type: "easy", hr_zone: "zone3" }))).toBe("threshold_tempo");
    expect(classifyWorkout(w({ type: "easy", hr_zone: "zone5" }))).toBe("intervals");
    expect(classifyWorkout(w({ type: "tempo", hr_zone: "zone2" }))).toBe("recovery_easy");
  });

  it("pins: structural types always win over hr_zone", () => {
    expect(classifyWorkout(w({ type: "long_run", hr_zone: "zone3" }))).toBe("long");
    expect(classifyWorkout(w({ type: "interval", hr_zone: "zone2" }))).toBe("intervals");
    expect(classifyWorkout(w({ type: "rest", hr_zone: "zone4" }))).toBe("rest_race");
  });

  it("classifies unknown types via hr_zone, else null", () => {
    expect(classifyWorkout(w({ type: "fartlek", hr_zone: "zone2" }))).toBe("recovery_easy");
    expect(classifyWorkout(w({ type: "fartlek" }))).toBeNull();
    expect(classifyWorkout(w({ type: "" }))).toBeNull();
  });

  it("isRace forces rest_race regardless of workout content", () => {
    expect(classifyWorkout(w({ type: "tempo" }), { isRace: true })).toBe("rest_race");
  });

  it("classifies short-key persisted workouts after normalization", () => {
    // recommendation_workout is stored short-key; the API boundary must expand
    // it before the engine sees it.
    const shortKey = { t: "easy", hr: "zone2", km: 10, min: 55, desc: "locker" };
    const expanded = expandWorkoutShortKeys(shortKey);
    expect(expanded).toMatchObject({ type: "easy", hr_zone: "zone2", distance_km: 10 });
    expect(classifyWorkout(expanded as WorkoutDetails)).toBe("recovery_easy");
    // Idempotent: expanding an already-long-key workout changes nothing.
    expect(expandWorkoutShortKeys(expanded)).toEqual(expanded);
  });
});
