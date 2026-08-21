// The guardrail invariant, encoded as tests that MUST fail if violated:
// no merge may change any member's zone/stimulus.

import { describe, expect, it } from "vitest";
import { assertStimulusPreserved } from "../guardrails";
import type { Compromise, EngineMember, EngineSession } from "../types";
import type { WorkoutDetails } from "@/lib/types";

const member = (id: number, thresholdPaceSec: number | null = 300): EngineMember => ({
  id,
  name: `M${id}`,
  visibility: "full",
  thresholdPaceSec,
  paceZones: null,
});

const session = (
  id: number,
  memberId: number,
  workout: Partial<WorkoutDetails>,
  over: Partial<EngineSession> = {},
): EngineSession => ({
  id,
  memberId,
  date: "2026-07-14",
  flexDays: 0,
  workout: { type: "easy", description: "", ...workout },
  ...over,
});

const compromise = (over: Partial<Compromise>): Compromise => ({
  date: "2026-07-14",
  weekday: 1,
  compatClass: "recovery_easy",
  mode: "SHARED_PACE",
  memberIds: [1, 2],
  memberSessionIds: [1, 2],
  noteKey: "shared_pace",
  ...over,
});

describe("guardrail: no merge may change any member's zone/stimulus", () => {
  it("rejects a cross-class merge (A's recovery pulled into B's threshold)", () => {
    const sessions = [
      session(1, 1, { type: "recovery" }),
      session(2, 2, { type: "tempo", hr_zone: "zone4" }),
    ];
    const bad = compromise({
      compatClass: "threshold_tempo",
      mode: "SHARED",
      sharedPaceSecPerKm: 300,
    });
    const result = assertStimulusPreserved(bad, sessions, [member(1), member(2)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/cross-class/);
  });

  it("rejects a shared easy pace outside a member's Z1–2 band", () => {
    const sessions = [session(1, 1, { type: "easy" }), session(2, 2, { type: "easy" })];
    // Member 1 threshold 250 → easy band [263..337]; 400 is far outside.
    const bad = compromise({ sharedPaceSecPerKm: 400 });
    const result = assertStimulusPreserved(bad, sessions, [member(1, 250), member(2, 305)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/easy band/);
  });

  it("accepts a shared easy pace inside everyone's Z1–2 band", () => {
    const sessions = [session(1, 1, { type: "easy" }), session(2, 2, { type: "easy" })];
    const good = compromise({ sharedPaceSecPerKm: 330 });
    expect(assertStimulusPreserved(good, sessions, [member(1, 250), member(2, 305)])).toEqual({
      ok: true,
    });
  });

  it("rejects SHARED threshold when the pace sits beyond the band for a member", () => {
    const sessions = [
      session(1, 1, { type: "tempo" }),
      session(2, 2, { type: "tempo" }),
    ];
    const bad = compromise({
      compatClass: "threshold_tempo",
      mode: "SHARED",
      sharedPaceSecPerKm: 283, // member 1's threshold is 250 → 33s off
    });
    const result = assertStimulusPreserved(bad, sessions, [member(1, 250), member(2, 283)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/band/);
  });

  it("rejects any shared pace on interval sessions", () => {
    const sessions = [
      session(1, 1, { type: "interval", intervals: [{ reps: 6, distance_m: 1000 }] }),
      session(2, 2, { type: "interval", intervals: [{ reps: 6, distance_m: 1000 }] }),
    ];
    const bad = compromise({
      compatClass: "intervals",
      mode: "PARALLEL_SAME_STRUCTURE",
      sharedPaceSecPerKm: 240,
    });
    const result = assertStimulusPreserved(bad, sessions, [member(1), member(2)]);
    expect(result.ok).toBe(false);
  });

  it("rejects any compromise on rest/race sessions", () => {
    const sessions = [session(1, 1, { type: "rest" }), session(2, 2, { type: "rest" })];
    for (const mode of ["SHARED_PACE", "COLOCATED_OPTIONAL", "PARALLEL_TIME_BASED"] as const) {
      const bad = compromise({ compatClass: "rest_race", mode, sharedPaceSecPerKm: undefined });
      expect(assertStimulusPreserved(bad, sessions, [member(1), member(2)]).ok).toBe(false);
    }
  });

  it("rejects a mode the matrix does not allow for the class", () => {
    const sessions = [session(1, 1, { type: "tempo" }), session(2, 2, { type: "tempo" })];
    const bad = compromise({
      compatClass: "threshold_tempo",
      mode: "SHARED_PACE", // easy-mode on a threshold cluster
      sharedPaceSecPerKm: 300,
    });
    expect(assertStimulusPreserved(bad, sessions, [member(1), member(2)]).ok).toBe(false);
  });

  it("rejects pace-sharing modes without a shared pace, and members without pace data", () => {
    const sessions = [session(1, 1, { type: "easy" }), session(2, 2, { type: "easy" })];
    const noPace = compromise({ sharedPaceSecPerKm: undefined });
    expect(assertStimulusPreserved(noPace, sessions, [member(1), member(2)]).ok).toBe(false);

    const withDataless = compromise({ sharedPaceSecPerKm: 330 });
    expect(
      assertStimulusPreserved(withDataless, sessions, [member(1, null), member(2, 305)]).ok,
    ).toBe(false);
  });

  it("rejects shifts that exceed a session's flexDays", () => {
    const sessions = [
      session(1, 1, { type: "easy" }, { date: "2026-07-13", flexDays: 1 }),
      session(2, 2, { type: "easy" }),
    ];
    const bad = compromise({
      sharedPaceSecPerKm: 330,
      shifted: [{ sessionId: 1, from: "2026-07-13", to: "2026-07-16" }], // 3 days > flex 1
    });
    const result = assertStimulusPreserved(bad, sessions, [member(1), member(2)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/flexDays/);
  });
});
