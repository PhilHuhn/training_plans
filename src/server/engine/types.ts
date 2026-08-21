// Pure types for the club matching engine. This directory must stay free of
// imports from @/server/db, next/*, and the Anthropic SDK — see CLAUDE.md.

import type { WorkoutDetails } from "@/lib/types";
import type { ZoneMap } from "@/lib/zone-calc";

/** Compatibility class a session is bucketed into before matching. */
export type CompatClass =
  | "recovery_easy"
  | "long"
  | "threshold_tempo"
  | "intervals"
  | "strength_cross"
  | "rest_race";

export type MergeMode =
  | "SHARED_PACE" // run together at the slowest member's easy pace
  | "SHARED_EASY_SEGMENT" // shared easy kms, quality segments split
  | "SHARED" // shared threshold effort (pace spread within band)
  | "PARALLEL_TIME_BASED" // same route, X min at own threshold
  | "PARALLEL_SAME_STRUCTURE" // same interval skeleton, own pace
  | "COLOCATED_OPTIONAL" // same location possible, no shared running
  | "NO_MATCH";

export type EngineMember = {
  id: number;
  name: string;
  visibility: "typ_only" | "full";
  /** Threshold pace in sec/km (users.preferences.threshold_pace). */
  thresholdPaceSec: number | null;
  /** Pace zones (sec/km; `min` is the SLOWER bound). */
  paceZones: ZoneMap | null;
};

export type EngineSession = {
  id: number;
  memberId: number;
  /** YYYY-MM-DD */
  date: string;
  /** ± days this session may shift; 0 = pinned. */
  flexDays: number;
  workout: WorkoutDetails;
  /** True when the session date collides with a competition (caller-provided). */
  isRace?: boolean;
};

export type SessionShift = { sessionId: number; from: string; to: string };

/** Computed, never persisted. */
export type Compromise = {
  /** YYYY-MM-DD (post-shift day the group meets on). */
  date: string;
  /** 0 = Monday … 6 = Sunday, relative to weekStart. */
  weekday: number;
  compatClass: CompatClass;
  mode: MergeMode;
  memberIds: number[];
  memberSessionIds: number[];
  /** Only for pace-sharing modes (SHARED_PACE / SHARED_EASY_SEGMENT / SHARED). */
  sharedPaceSecPerKm?: number;
  /** Interval skeleton label (e.g. "6×1000m") for PARALLEL_SAME_STRUCTURE. */
  skeleton?: string;
  shifted?: SessionShift[];
  noteKey: string;
};

export type MatchWeekInput = {
  members: EngineMember[];
  sessions: EngineSession[];
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
};

export type MatchWeekResult = {
  compromises: Compromise[];
  shifts: SessionShift[];
};

export type GuardrailResult = { ok: true } | { ok: false; reason: string };
