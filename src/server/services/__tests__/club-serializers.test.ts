// Visibility choke-point tests: typ_only members' paces must not leak —
// neither directly (session fields) nor indirectly (compromise notes/pace).

import { describe, expect, it } from "vitest";
import type { Compromise } from "@/server/engine/types";
import {
  serializeCompromise,
  serializeMemberSession,
  type OverlayMember,
  type OverlaySession,
  type Viewer,
} from "../club-serializers";

const member = (userId: number, visibility: "typ_only" | "full"): OverlayMember => ({
  userId,
  name: `User ${userId}`,
  role: "athlete",
  visibility,
});

const session = (id: number, userId: number): OverlaySession => ({
  id,
  userId,
  sessionDate: "2026-07-14",
  status: "planned",
  workout: {
    type: "easy",
    description: "Lockerer DL mit Steigerungen",
    duration_min: 50,
    distance_km: 10,
    pace_range: "5:30-5:45",
    hr_zone: "zone2",
    intensity: "low",
    intervals: [{ reps: 4, distance_m: 100, target_pace: "4:00" }],
  },
});

const athleteViewer: Viewer = { userId: 99, isCoach: false };
const coachViewer: Viewer = { userId: 100, isCoach: true };

describe("serializeMemberSession", () => {
  it("redacts everything but availability/type/duration for typ_only members", () => {
    const wire = serializeMemberSession(session(1, 2), member(2, "typ_only"), athleteViewer);
    expect(wire).toEqual({
      session_id: 1,
      user_id: 2,
      session_date: "2026-07-14",
      status: "planned",
      session_type: "easy",
      duration_min: 50,
      redacted: true,
    });
    // Paranoia: no pace-bearing field survives on the wire object.
    expect(JSON.stringify(wire)).not.toMatch(/5:30|zone2|Steigerungen/);
  });

  it("keeps full data for full-visibility members, self, and coaches", () => {
    const full = serializeMemberSession(session(1, 2), member(2, "full"), athleteViewer);
    expect(full.redacted).toBe(false);
    expect(full.pace_range).toBe("5:30-5:45");

    const self = serializeMemberSession(
      session(1, 2),
      member(2, "typ_only"),
      { userId: 2, isCoach: false },
    );
    expect(self.redacted).toBe(false);

    const coach = serializeMemberSession(session(1, 2), member(2, "typ_only"), coachViewer);
    expect(coach.redacted).toBe(false);
    expect(coach.intervals).toHaveLength(1);
  });
});

describe("serializeCompromise — indirect pace leaks", () => {
  const compromise: Compromise = {
    date: "2026-07-14",
    weekday: 1,
    compatClass: "recovery_easy",
    mode: "SHARED_PACE",
    memberIds: [1, 2],
    memberSessionIds: [10, 11],
    sharedPaceSecPerKm: 336,
    noteKey: "shared_pace",
  };

  it("strips shared pace and uses the safe note when any participant is typ_only", () => {
    const wire = serializeCompromise(compromise, [member(1, "full"), member(2, "typ_only")], athleteViewer);
    expect(wire.shared_pace_sec).toBeNull();
    expect(wire.note).not.toMatch(/5:36|336/);
    expect(wire.note.length).toBeGreaterThan(0);
  });

  it("includes pace when all participants are full", () => {
    const wire = serializeCompromise(compromise, [member(1, "full"), member(2, "full")], athleteViewer);
    expect(wire.shared_pace_sec).toBe(336);
    expect(wire.note).toMatch(/5:36/);
  });

  it("coaches always see the pace-bearing note", () => {
    const wire = serializeCompromise(compromise, [member(1, "full"), member(2, "typ_only")], coachViewer);
    expect(wire.shared_pace_sec).toBe(336);
  });
});
