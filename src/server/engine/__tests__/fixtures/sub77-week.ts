// The sub-77 sanity week: shared between the engine test suite and
// scripts/seed-club.ts so the seeded demo data and the pinned engine
// expectations can never drift apart.
//
// Constructed so every merge mode appears at least once:
//   Tue  all four easy            → SHARED_PACE (incl. Hanna's Mon flex shift)
//   Wed  3× threshold, 2 in band  → SHARED pair + PARALLEL_TIME_BASED trio
//   Thu  2× 6×1000m               → PARALLEL_SAME_STRUCTURE
//   Thu  2× strength              → COLOCATED_OPTIONAL
//   Fri  rest / Sat race          → never matched
//   Sun  2× long run              → SHARED_EASY_SEGMENT

import type { WorkoutDetails } from "@/lib/types";
import type { EngineMember, EngineSession, MatchWeekInput } from "../../types";

export const SUB77_WEEK_START = "2026-07-13"; // Monday

export type Sub77Athlete = {
  key: string;
  name: string;
  email: string;
  /** sec/km */
  thresholdPaceSec: number;
  goalRaceType: "M" | "10K" | "HM";
  goalRaceName: string;
};

export const SUB77_ATHLETES: Sub77Athlete[] = [
  {
    key: "mara",
    name: "Mara Petersen",
    email: "mara@sub77.example",
    thresholdPaceSec: 250,
    goalRaceType: "M",
    goalRaceName: "Hamburg Marathon",
  },
  {
    key: "tade",
    name: "Tade Krohn",
    email: "tade@sub77.example",
    thresholdPaceSec: 275,
    goalRaceType: "10K",
    goalRaceName: "Alsterlauf 10k",
  },
  {
    key: "timo",
    name: "Timo Albers",
    email: "timo@sub77.example",
    thresholdPaceSec: 283,
    goalRaceType: "10K",
    goalRaceName: "Alsterlauf 10k",
  },
  {
    key: "hanna",
    name: "Hanna Voss",
    email: "hanna@sub77.example",
    thresholdPaceSec: 305,
    goalRaceType: "HM",
    goalRaceName: "Halbmarathon Lübeck",
  },
];

export type Sub77PlannedSession = {
  athleteKey: string;
  /** YYYY-MM-DD within the fixture week. */
  date: string;
  flexDays: number;
  isRace?: boolean;
  workout: WorkoutDetails;
};

const easy = (durationMin: number, distanceKm?: number): WorkoutDetails => ({
  type: "easy",
  sport: "running",
  description: "Lockerer Dauerlauf",
  duration_min: durationMin,
  ...(distanceKm ? { distance_km: distanceKm } : {}),
  intensity: "low",
  hr_zone: "zone2",
});

export const SUB77_SESSIONS: Sub77PlannedSession[] = [
  // Mon — Hanna's easy run is flexible by ±1 day; should shift to Tuesday.
  { athleteKey: "hanna", date: "2026-07-13", flexDays: 1, workout: easy(40) },

  // Tue — easy cluster.
  { athleteKey: "mara", date: "2026-07-14", flexDays: 0, workout: easy(60, 12) },
  { athleteKey: "tade", date: "2026-07-14", flexDays: 0, workout: easy(50, 9) },
  { athleteKey: "timo", date: "2026-07-14", flexDays: 0, workout: easy(50, 9) },

  // Wed — threshold cluster: Mara (250) outside the 15s band, Tade/Timo inside.
  {
    athleteKey: "mara",
    date: "2026-07-15",
    flexDays: 0,
    workout: {
      type: "tempo",
      sport: "running",
      description: "3×10 min Schwelle",
      duration_min: 55,
      intensity: "high",
      hr_zone: "zone4",
    },
  },
  {
    athleteKey: "tade",
    date: "2026-07-15",
    flexDays: 0,
    workout: {
      type: "tempo",
      sport: "running",
      description: "25 min Schwellendauerlauf",
      duration_min: 50,
      intensity: "high",
      hr_zone: "zone4",
    },
  },
  {
    athleteKey: "timo",
    date: "2026-07-15",
    flexDays: 0,
    workout: {
      type: "tempo",
      sport: "running",
      description: "25 min Schwellendauerlauf",
      duration_min: 50,
      intensity: "high",
      hr_zone: "zone4",
    },
  },

  // Thu — identical interval skeletons (Tade/Timo) + strength (Mara/Hanna).
  {
    athleteKey: "tade",
    date: "2026-07-16",
    flexDays: 0,
    workout: {
      type: "interval",
      sport: "running",
      description: "6×1000 m, Trabpause",
      duration_min: 55,
      intensity: "high",
      intervals: [{ reps: 6, distance_m: 1000, target_pace: "4:25", recovery: "90s Trab" }],
    },
  },
  {
    athleteKey: "timo",
    date: "2026-07-16",
    flexDays: 0,
    workout: {
      type: "interval",
      sport: "running",
      description: "6×1000 m, Trabpause",
      duration_min: 55,
      intensity: "high",
      intervals: [{ reps: 6, distance_m: 1000, target_pace: "4:35", recovery: "90s Trab" }],
    },
  },
  {
    athleteKey: "mara",
    date: "2026-07-16",
    flexDays: 0,
    workout: {
      type: "cross_training",
      sport: "strength",
      description: "Kraft: Rumpf + Beine",
      duration_min: 45,
      intensity: "moderate",
    },
  },
  {
    athleteKey: "hanna",
    date: "2026-07-16",
    flexDays: 0,
    workout: {
      type: "strength",
      sport: "strength",
      description: "Kraft: Stabilisation",
      duration_min: 40,
      intensity: "moderate",
    },
  },

  // Fri — rest for two athletes: must never produce a compromise.
  {
    athleteKey: "mara",
    date: "2026-07-17",
    flexDays: 0,
    workout: { type: "rest", description: "Ruhetag" },
  },
  {
    athleteKey: "tade",
    date: "2026-07-17",
    flexDays: 0,
    workout: { type: "rest", description: "Ruhetag" },
  },

  // Sat — Hanna races (never matched), Tade runs a solo easy (no partner).
  {
    athleteKey: "hanna",
    date: "2026-07-18",
    flexDays: 0,
    isRace: true,
    workout: { type: "race", description: "10k Testwettkampf", duration_min: 50 },
  },
  { athleteKey: "tade", date: "2026-07-18", flexDays: 0, workout: easy(35, 6) },

  // Sun — long runs: Mara with goal-pace segments, Hanna plain.
  {
    athleteKey: "mara",
    date: "2026-07-19",
    flexDays: 0,
    workout: {
      type: "long_run",
      sport: "running",
      description: "30 km, letzte 3×2 km im Marathon-Zieltempo",
      distance_km: 30,
      duration_min: 150,
      intensity: "moderate",
      intervals: [{ reps: 3, distance_m: 2000, target_pace: "4:35", recovery: "1 km locker" }],
    },
  },
  {
    athleteKey: "hanna",
    date: "2026-07-19",
    flexDays: 0,
    workout: {
      type: "long_run",
      sport: "running",
      description: "22 km ruhig",
      distance_km: 22,
      duration_min: 135,
      intensity: "low",
    },
  },
];

/**
 * Deterministic engine input: member ids 1–4 in SUB77_ATHLETES order, session
 * ids 1–n in SUB77_SESSIONS order. paceZones left null to exercise the
 * threshold-pace fallback.
 */
export function sub77EngineInput(): MatchWeekInput {
  const members: EngineMember[] = SUB77_ATHLETES.map((a, i) => ({
    id: i + 1,
    name: a.name,
    visibility: "full",
    thresholdPaceSec: a.thresholdPaceSec,
    paceZones: null,
  }));
  const memberIdByKey = new Map(SUB77_ATHLETES.map((a, i) => [a.key, i + 1]));

  const sessions: EngineSession[] = SUB77_SESSIONS.map((s, i) => ({
    id: i + 1,
    memberId: memberIdByKey.get(s.athleteKey) as number,
    date: s.date,
    flexDays: s.flexDays,
    isRace: s.isRace,
    workout: s.workout,
  }));

  return { members, sessions, weekStart: SUB77_WEEK_START };
}
