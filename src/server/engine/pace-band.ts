// Pace-band math for the matching engine. Pace convention throughout: sec/km,
// and in stored zone maps `min` is the SLOWER bound (larger number). All
// helpers are inversion-robust: they take min/max of the raw values instead of
// trusting the field names.

import { calculatePaceZonesFromThreshold, type ZoneMap } from "@/lib/zone-calc";
import type { EngineMember } from "./types";

export type EasyRange = {
  /** Slowest acceptable easy pace (largest sec/km). */
  slow: number;
  /** Fastest acceptable easy pace (smallest sec/km). */
  fast: number;
};

function zonesOf(member: EngineMember): ZoneMap | null {
  if (member.paceZones && member.paceZones.zone1 && member.paceZones.zone2) {
    return member.paceZones;
  }
  if (member.thresholdPaceSec && member.thresholdPaceSec > 0) {
    return calculatePaceZonesFromThreshold(member.thresholdPaceSec);
  }
  return null;
}

/** Member's easy band = union of pace zones 1–2. Null without pace data. */
export function easyPaceRange(member: EngineMember): EasyRange | null {
  const zones = zonesOf(member);
  if (!zones?.zone1 || !zones?.zone2) return null;
  const bounds = [zones.zone1.min, zones.zone1.max, zones.zone2.min, zones.zone2.max];
  return { slow: Math.max(...bounds), fast: Math.min(...bounds) };
}

/** Member's typical easy pace = midpoint of zone 2. Null without pace data. */
export function typicalEasyPace(member: EngineMember): number | null {
  const zones = zonesOf(member);
  if (!zones?.zone2) return null;
  return Math.round((zones.zone2.min + zones.zone2.max) / 2);
}

/** Member's threshold pace: explicit value, else zone-4 midpoint. */
export function thresholdPaceOf(member: EngineMember): number | null {
  if (member.thresholdPaceSec && member.thresholdPaceSec > 0) {
    return member.thresholdPaceSec;
  }
  const z4 = member.paceZones?.zone4;
  if (z4) return Math.round((z4.min + z4.max) / 2);
  return null;
}

/** Max pairwise threshold spread; Infinity when any member lacks pace data. */
export function thresholdSpread(members: EngineMember[]): number {
  const paces = members.map(thresholdPaceOf);
  if (paces.some((p) => p == null)) return Infinity;
  const nums = paces as number[];
  return Math.max(...nums) - Math.min(...nums);
}

export type SharedEasyResult = {
  /** Sec/km — the slowest participating member's typical easy pace. */
  sharedPaceSecPerKm: number;
  /** Members whose easy band contains the shared pace (≥ 2). */
  memberIds: number[];
};

/**
 * Shared easy pace = the slowest member's typical easy pace, restricted to
 * members whose own easy band contains it (guardrail: no one gets pulled out
 * of Z1–2). Members without pace data are never pace-shared. Iterates because
 * dropping the slowest member moves the shared pace. Null when fewer than two
 * members remain.
 */
export function sharedEasyPace(members: EngineMember[]): SharedEasyResult | null {
  let eligible = members.filter((m) => easyPaceRange(m) != null && typicalEasyPace(m) != null);

  for (;;) {
    if (eligible.length < 2) return null;
    const shared = Math.max(...eligible.map((m) => typicalEasyPace(m) as number));
    const fits = eligible.filter((m) => {
      const range = easyPaceRange(m) as EasyRange;
      return shared <= range.slow && shared >= range.fast;
    });
    if (fits.length === eligible.length) {
      return {
        sharedPaceSecPerKm: shared,
        memberIds: eligible.map((m) => m.id).sort((a, b) => a - b),
      };
    }
    eligible = fits;
  }
}
