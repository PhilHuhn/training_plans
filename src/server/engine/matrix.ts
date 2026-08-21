// Compatibility matrix — CONFIG, not logic. Tune merge behavior here without
// touching the matcher. Every mode listed in `allowedModes` is what the
// guardrail permits for that class; the matcher picks among them.

import type { CompatClass, MergeMode } from "./types";

/**
 * Max threshold-pace spread (sec/km) within which a threshold/tempo cluster
 * may run as one SHARED effort. Beyond it: PARALLEL_TIME_BASED.
 */
export const THRESHOLD_SHARE_BAND_SEC = 15;

export type MatrixEntry = {
  /** Primary mode, or "conditional" (resolved from pace spread at match time). */
  mode: MergeMode | "conditional";
  /** Every mode the guardrail accepts for this class. */
  allowedModes: MergeMode[];
  /** Whether the primary/shared mode carries a shared pace. */
  paceSharing: boolean;
  thresholdBandSec?: number;
  noteKey: string;
};

export const MERGE_MATRIX: Record<CompatClass, MatrixEntry> = {
  recovery_easy: {
    mode: "SHARED_PACE",
    allowedModes: ["SHARED_PACE"],
    paceSharing: true,
    noteKey: "shared_pace",
  },
  long: {
    mode: "SHARED_EASY_SEGMENT",
    allowedModes: ["SHARED_EASY_SEGMENT"],
    paceSharing: true,
    noteKey: "shared_easy_segment",
  },
  threshold_tempo: {
    mode: "conditional",
    allowedModes: ["SHARED", "PARALLEL_TIME_BASED"],
    paceSharing: true,
    thresholdBandSec: THRESHOLD_SHARE_BAND_SEC,
    noteKey: "threshold",
  },
  intervals: {
    mode: "PARALLEL_SAME_STRUCTURE",
    allowedModes: ["PARALLEL_SAME_STRUCTURE"],
    paceSharing: false,
    noteKey: "parallel_structure",
  },
  strength_cross: {
    mode: "COLOCATED_OPTIONAL",
    allowedModes: ["COLOCATED_OPTIONAL"],
    paceSharing: false,
    noteKey: "colocated",
  },
  rest_race: {
    mode: "NO_MATCH",
    allowedModes: [],
    paceSharing: false,
    noteKey: "none",
  },
};
