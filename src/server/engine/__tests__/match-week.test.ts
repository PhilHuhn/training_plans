import { describe, expect, it } from "vitest";
import { matchWeek } from "../match-week";
import type { EngineMember, EngineSession, MatchWeekInput } from "../types";
import type { WorkoutDetails } from "@/lib/types";
import { sub77EngineInput, SUB77_WEEK_START } from "./fixtures/sub77-week";

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
  date: string,
  workout: Partial<WorkoutDetails>,
  over: Partial<EngineSession> = {},
): EngineSession => ({
  id,
  memberId,
  date,
  flexDays: 0,
  workout: { type: "easy", description: "", ...workout },
  ...over,
});

const WEEK = "2026-07-13"; // Monday

describe("matchWeek — flex shifting", () => {
  it("shifts a flexDays:1 session Mon→Tue to join an easy cluster", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1, 250), member(2, 305)],
      sessions: [
        session(1, 2, "2026-07-13", { type: "easy" }, { flexDays: 1 }),
        session(2, 1, "2026-07-14", { type: "easy" }),
      ],
    };
    const { compromises, shifts } = matchWeek(input);
    expect(shifts).toEqual([{ sessionId: 1, from: "2026-07-13", to: "2026-07-14" }]);
    expect(compromises).toHaveLength(1);
    expect(compromises[0].mode).toBe("SHARED_PACE");
    expect(compromises[0].date).toBe("2026-07-14");
    expect(compromises[0].shifted).toEqual(shifts);
  });

  it("never moves a flexDays:0 session", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1, 250), member(2, 305)],
      sessions: [
        session(1, 2, "2026-07-13", { type: "easy" }), // pinned
        session(2, 1, "2026-07-14", { type: "easy" }),
      ],
    };
    const { compromises, shifts } = matchWeek(input);
    expect(shifts).toEqual([]);
    expect(compromises).toEqual([]);
  });

  it("never shifts onto a day where the member already trains", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1, 250), member(2, 305)],
      sessions: [
        session(1, 2, "2026-07-13", { type: "easy" }, { flexDays: 1 }),
        session(2, 2, "2026-07-14", { type: "tempo" }), // member 2 busy on Tue
        session(3, 1, "2026-07-14", { type: "easy" }),
      ],
    };
    const { shifts } = matchWeek(input);
    expect(shifts).toEqual([]);
  });
});

describe("matchWeek — threshold band resolution", () => {
  it("spread within band → single SHARED, no parallel duplicate", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1, 280), member(2, 292)], // 12s spread
      sessions: [
        session(1, 1, "2026-07-15", { type: "tempo" }),
        session(2, 2, "2026-07-15", { type: "tempo" }),
      ],
    };
    const { compromises } = matchWeek(input);
    expect(compromises).toHaveLength(1);
    expect(compromises[0].mode).toBe("SHARED");
    // Slowest participant's threshold — nobody is forced faster.
    expect(compromises[0].sharedPaceSecPerKm).toBe(292);
  });

  it("spread beyond band → PARALLEL_TIME_BASED, never a forced shared pace", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1, 280), member(2, 310)], // 30s spread
      sessions: [
        session(1, 1, "2026-07-15", { type: "tempo" }),
        session(2, 2, "2026-07-15", { type: "tempo" }),
      ],
    };
    const { compromises } = matchWeek(input);
    expect(compromises).toHaveLength(1);
    expect(compromises[0].mode).toBe("PARALLEL_TIME_BASED");
    expect(compromises[0].sharedPaceSecPerKm).toBeUndefined();
  });
});

describe("matchWeek — intervals", () => {
  it("identical skeletons run parallel with no shared pace", () => {
    const ivl = { intervals: [{ reps: 6, distance_m: 1000 }] };
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1), member(2)],
      sessions: [
        session(1, 1, "2026-07-16", { type: "interval", ...ivl }),
        session(2, 2, "2026-07-16", { type: "interval", ...ivl }),
      ],
    };
    const { compromises } = matchWeek(input);
    expect(compromises).toHaveLength(1);
    expect(compromises[0].mode).toBe("PARALLEL_SAME_STRUCTURE");
    expect(compromises[0].skeleton).toBe("6×1000m");
    expect(compromises[0].sharedPaceSecPerKm).toBeUndefined();
  });

  it("differing skeletons do not match", () => {
    const input: MatchWeekInput = {
      weekStart: WEEK,
      members: [member(1), member(2)],
      sessions: [
        session(1, 1, "2026-07-16", {
          type: "interval",
          intervals: [{ reps: 6, distance_m: 1000 }],
        }),
        session(2, 2, "2026-07-16", {
          type: "interval",
          intervals: [{ reps: 5, distance_m: 1200 }],
        }),
      ],
    };
    expect(matchWeek(input).compromises).toEqual([]);
  });
});

describe("matchWeek — determinism", () => {
  it("same input (even shuffled) → identical output", () => {
    const input = sub77EngineInput();
    const first = matchWeek(input);
    const second = matchWeek(input);
    expect(second).toEqual(first);

    const shuffled = { ...input, sessions: [...input.sessions].reverse() };
    expect(matchWeek(shuffled)).toEqual(first);
  });
});

describe("matchWeek — sub-77 fixture week (seed sanity contract)", () => {
  // Member ids: 1 Mara (250), 2 Tade (275), 3 Timo (283), 4 Hanna (305).
  const { compromises, shifts } = matchWeek(sub77EngineInput());

  it("shifts Hanna's flexible Monday easy run to Tuesday", () => {
    expect(shifts).toEqual([{ sessionId: 1, from: "2026-07-13", to: "2026-07-14" }]);
  });

  it("emits exactly the expected compromise set", () => {
    expect(
      compromises.map((c) => ({ weekday: c.weekday, mode: c.mode, members: c.memberIds })),
    ).toEqual([
      { weekday: 1, mode: "SHARED_PACE", members: [1, 2, 3, 4] },
      { weekday: 2, mode: "SHARED", members: [2, 3] },
      { weekday: 2, mode: "PARALLEL_TIME_BASED", members: [1, 2, 3] },
      { weekday: 3, mode: "PARALLEL_SAME_STRUCTURE", members: [2, 3] },
      { weekday: 3, mode: "COLOCATED_OPTIONAL", members: [1, 4] },
      { weekday: 6, mode: "SHARED_EASY_SEGMENT", members: [1, 4] },
    ]);
  });

  it("Tuesday shared easy pace is the slowest member's typical easy pace", () => {
    const tue = compromises.find((c) => c.mode === "SHARED_PACE");
    // Hanna (threshold 305): zone-2 midpoint of calculatePaceZonesFromThreshold.
    expect(tue?.sharedPaceSecPerKm).toBe(336);
  });

  it("Wednesday SHARED uses the slower of the two in-band thresholds", () => {
    const shared = compromises.find((c) => c.mode === "SHARED");
    expect(shared?.sharedPaceSecPerKm).toBe(283);
  });

  it("long-run compromise stays in the easy band — goal-pace segments untouched", () => {
    const long = compromises.find((c) => c.mode === "SHARED_EASY_SEGMENT");
    expect(long?.memberIds).toEqual([1, 4]);
    expect(long?.sharedPaceSecPerKm).toBe(336);
    // Mara's marathon goal-pace segments (4:35 = 275 s/km) are NOT the shared
    // pace — only the easy kilometers are shared.
    expect(long?.sharedPaceSecPerKm).not.toBe(275);
  });

  it("rest days and race days never appear in any compromise", () => {
    // Fri (weekday 4): two rest sessions; Sat (weekday 5): race + solo easy.
    expect(compromises.filter((c) => c.weekday === 4 || c.weekday === 5)).toEqual([]);
    // Hanna's race session (id 14) is in no compromise.
    expect(compromises.some((c) => c.memberSessionIds.includes(14))).toBe(false);
  });
});
