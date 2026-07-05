import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, users, zoneHistory, type Activity, type User, type UserPreferences } from "@/server/db/schema";

import {
  HR_ZONE_FRACTIONS,
  calculateCyclingPowerZonesFromFtp,
  calculateHrZonesFromMax,
  calculateHrZonesFromThreshold,
  calculatePaceZonesFromThreshold,
  type HrZoneKey,
  type ZoneMap,
} from "@/lib/zone-calc";

// Pure zone math lives in src/lib/zone-calc.ts so the settings page can run
// the same calculations client-side ("Calc Zones" buttons). Re-exported here
// because training-load.ts, fit-export.ts, and the zones routes import from
// this module.
export {
  HR_ZONE_FRACTIONS,
  calculateCyclingPowerZonesFromFtp,
  calculateHrZonesFromMax,
  calculateHrZonesFromThreshold,
  calculatePaceZonesFromThreshold,
  type HrZoneKey,
};

/**
 * Resolve a zone key to a [low, high] bpm range, preferring user-supplied
 * preferences if they include the zone; otherwise falling back to the
 * HR-reserve formula. Returns null if neither is available.
 */
export function resolveHrZoneBpm(
  zoneKey: string,
  prefs: UserPreferences | null | undefined,
  maxHr: number | null | undefined,
  restingHr: number | null | undefined,
): [number, number] | null {
  const fromPrefs = prefs?.hr_zones?.[zoneKey];
  if (fromPrefs && Number.isFinite(fromPrefs.min) && Number.isFinite(fromPrefs.max)) {
    return [fromPrefs.min, fromPrefs.max];
  }
  if (!maxHr || !restingHr || maxHr <= restingHr) return null;
  const fractions = (HR_ZONE_FRACTIONS as Record<string, { low: number; high: number }>)[zoneKey];
  if (!fractions) return null;
  const hrr = maxHr - restingHr;
  return [
    Math.round(restingHr + hrr * fractions.low),
    Math.round(restingHr + hrr * fractions.high),
  ];
}

/** Midpoint of the resolved zone, used by TRIMP estimation. */
export function hrZoneMidpoint(
  zoneKey: string,
  prefs: UserPreferences | null | undefined,
  maxHr: number | null | undefined,
  restingHr: number | null | undefined,
): number | null {
  const range = resolveHrZoneBpm(zoneKey, prefs, maxHr, restingHr);
  if (!range) return null;
  return Math.round((range[0] + range[1]) / 2);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export type ZoneKind = "hr" | "pace" | "power";

const VALUE_BOUNDS: Record<ZoneKind, { min: number; max: number; label: string }> = {
  hr: { min: 30, max: 230, label: "bpm" },
  pace: { min: 100, max: 900, label: "sec/km" }, // 1:40 – 15:00
  power: { min: 0, max: 2000, label: "W" },
};

export function validateZones(zones: ZoneMap | null | undefined, kind: ZoneKind): ValidationResult {
  const errors: string[] = [];
  if (!zones || Object.keys(zones).length === 0) return { ok: true, errors };

  const bounds = VALUE_BOUNDS[kind];
  const sortedKeys = Object.keys(zones).sort();
  for (const k of sortedKeys) {
    const z = zones[k];
    if (!z) continue;
    if (!Number.isFinite(z.min) || !Number.isFinite(z.max)) {
      errors.push(`${k}: min and max must be numbers`);
      continue;
    }
    for (const v of [z.min, z.max]) {
      if (v < bounds.min || v > bounds.max) {
        errors.push(`${k}: ${v} out of range (${bounds.min}–${bounds.max} ${bounds.label})`);
      }
    }
    if (kind === "pace") {
      // Pace: min (slower) > max (faster)
      if (z.min < z.max) errors.push(`${k}: pace min (${z.min}) must be ≥ max (${z.max}); slower → faster`);
    } else {
      if (z.min > z.max) errors.push(`${k}: min (${z.min}) must be ≤ max (${z.max})`);
    }
  }

  // Contiguity: adjacent zones must neither gap nor overlap. Two boundary
  // conventions exist in the wild — the "+1" convention our calculators emit
  // (zone N+1 starts one unit past zone N's end) and the shared-boundary
  // convention (zone N+1 starts exactly at zone N's end), which older data,
  // Strava imports, and the settings-page cascade produce. Accept both.
  for (let i = 0; i < sortedKeys.length - 1; i++) {
    const a = zones[sortedKeys[i]];
    const b = zones[sortedKeys[i + 1]];
    if (!a || !b) continue;
    if (kind === "pace") {
      // Pace zones run slow → fast: zone1.max is the FAST end of the slow zone
      // (lower sec/km). The next zone's min (its slow end) sits at a.max or
      // a.max - 1 depending on convention.
      const delta = a.max - b.min;
      if (delta !== 0 && delta !== 1) {
        errors.push(`${sortedKeys[i]} → ${sortedKeys[i + 1]}: pace boundary not contiguous (expected ${sortedKeys[i + 1]} min = ${a.max} or ${a.max - 1}, got ${b.min})`);
      }
    } else {
      const delta = b.min - a.max;
      if (delta !== 0 && delta !== 1) {
        errors.push(`${sortedKeys[i]} → ${sortedKeys[i + 1]}: boundary not contiguous (expected ${sortedKeys[i + 1]} min = ${a.max} or ${a.max + 1}, got ${b.min})`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateHrAnchors(args: {
  max_hr?: number | null;
  resting_hr?: number | null;
  threshold_hr?: number | null;
}): ValidationResult {
  const errors: string[] = [];
  const { max_hr, resting_hr, threshold_hr } = args;
  if (max_hr != null && resting_hr != null && max_hr <= resting_hr + 50) {
    errors.push(`max_hr (${max_hr}) must be at least 50 bpm above resting_hr (${resting_hr})`);
  }
  if (threshold_hr != null) {
    if (max_hr != null && threshold_hr >= max_hr) {
      errors.push(`threshold_hr (${threshold_hr}) must be below max_hr (${max_hr})`);
    }
    if (resting_hr != null && threshold_hr <= resting_hr + 50) {
      errors.push(`threshold_hr (${threshold_hr}) must be at least 50 bpm above resting_hr (${resting_hr})`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Strava-driven estimation
// ---------------------------------------------------------------------------

const RUN_TYPES = ["Run", "run", "RUNNING", "TrailRun", "VirtualRun"];

export type ThresholdPaceSource = "sustained_runs" | "riegel" | "percentile" | "manual";
export type ThresholdHrSource = "sustained_efforts" | "max_fraction" | "manual";

/**
 * User-pinned anchor values for estimation. When present, the estimator uses
 * them verbatim instead of deriving them from activity data — this lets the
 * user correct e.g. a bad data-derived max HR and re-estimate only the rest.
 */
export interface EstimateAnchors {
  max_hr?: number | null;
  resting_hr?: number | null;
  threshold_hr?: number | null;
}

export interface ZoneEstimateResult {
  success: boolean;
  error?: string;
  activities_analyzed: number;
  date_range_start?: Date;
  date_range_end?: Date;
  max_hr?: number;
  resting_hr?: number;
  threshold_hr?: number;
  threshold_hr_source?: ThresholdHrSource;
  threshold_pace?: number;
  threshold_pace_source?: ThresholdPaceSource;
  hr_zones?: ZoneMap;
  pace_zones?: ZoneMap;
  avg_hr_easy_runs?: number | null;
  avg_hr_tempo_runs?: number | null;
  avg_pace_easy_runs?: number | null;
  avg_pace_tempo_runs?: number | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct)));
  return sorted[idx];
}

const TEMPO_NAME_RE = /(tempo|threshold|race|parkrun|5k|10k|half|marathon|t-run)/i;

interface PaceEstimate {
  value: number;
  source: ThresholdPaceSource;
}

/**
 * Estimate threshold pace from running activities, with a tiered fallback:
 *   1. Median pace from sustained quality runs (≥20 min, HR ≥75% of HR-reserve OR name match)
 *   2. Riegel projection from the user's fastest run ≥15 min in the period
 *   3. Current heuristic: 20th-percentile of all avg paces
 */
export function estimateThresholdPace(
  runs: Activity[],
  restingHr: number,
  maxHr: number,
): PaceEstimate | null {
  const allPaces = runs
    .map((r) => r.avgPace)
    .filter((p): p is number => typeof p === "number" && p > 0);

  // Tier 1: sustained quality runs
  const hrr = maxHr - restingHr;
  const hrThreshold = hrr > 0 ? restingHr + 0.75 * hrr : null;
  const tier1: number[] = [];
  for (const r of runs) {
    if (!r.avgPace || r.avgPace <= 0) continue;
    const durationMin = (r.duration ?? 0) / 60;
    if (durationMin < 20) continue;
    const isLongHr = hrThreshold != null && r.avgHeartRate != null && r.avgHeartRate >= hrThreshold;
    const nameMatch = TEMPO_NAME_RE.test(r.name ?? "");
    if (isLongHr || nameMatch) tier1.push(r.avgPace);
  }
  if (tier1.length >= 3) {
    return { value: Math.round(median(tier1)), source: "sustained_runs" };
  }

  // Tier 2: Riegel from fastest run ≥15 min
  let fastest: { pace: number; durationSec: number } | null = null;
  for (const r of runs) {
    if (!r.avgPace || r.avgPace <= 0) continue;
    const durSec = r.duration ?? 0;
    if (durSec < 15 * 60) continue;
    if (!fastest || r.avgPace < fastest.pace) {
      fastest = { pace: r.avgPace, durationSec: durSec };
    }
  }
  if (fastest) {
    // Riegel: t2 = t1 * (d2/d1)^1.06; for pace projected to 60-min effort:
    //   pace_60 = pace_a * (60min / t_a_min)^0.06
    const tAMin = fastest.durationSec / 60;
    const projected = fastest.pace * Math.pow(60 / tAMin, 0.06);
    return { value: Math.round(projected), source: "riegel" };
  }

  // Tier 3: 20th-percentile fallback
  if (allPaces.length === 0) return null;
  return { value: Math.round(percentile(allPaces, 0.2)), source: "percentile" };
}

interface HrEstimate {
  value: number;
  source: ThresholdHrSource;
}

/**
 * Estimate threshold HR from sustained running efforts. Requires ≥3 runs with
 * duration ≥20 min and recorded avg HR. Uses the 80th-percentile of those avg
 * HRs, clamped to ≤93% of max HR.
 */
export function estimateThresholdHr(runs: Activity[], maxHr: number): HrEstimate | null {
  const sustainedHrs: number[] = [];
  for (const r of runs) {
    const durMin = (r.duration ?? 0) / 60;
    if (durMin < 20) continue;
    if (r.avgHeartRate && r.avgHeartRate > 0) sustainedHrs.push(r.avgHeartRate);
  }
  if (sustainedHrs.length >= 3) {
    const p80 = percentile(sustainedHrs, 0.8);
    const clamped = Math.min(p80, maxHr * 0.93);
    return { value: Math.round(clamped), source: "sustained_efforts" };
  }
  return null;
}

export async function estimateZonesFromStrava(
  user: User,
  daysBack = 90,
  anchors: EstimateAnchors = {},
): Promise<ZoneEstimateResult> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const runs = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.userId, user.id),
        inArray(activities.activityType, RUN_TYPES),
        gte(activities.startDate, cutoff),
      ),
    )
    .orderBy(desc(activities.startDate));

  if (runs.length === 0) {
    return {
      success: false,
      error: `No running activities found in the last ${daysBack} days`,
      activities_analyzed: 0,
    };
  }

  const maxHrs: number[] = [];
  const easyHrs: number[] = [];
  const easyPaces: number[] = [];
  const tempoHrs: number[] = [];
  const tempoPaces: number[] = [];

  for (const a of runs) {
    if (a.maxHeartRate) maxHrs.push(a.maxHeartRate);
    const durationMins = (a.duration ?? 0) / 60;
    if (durationMins > 45 && a.avgHeartRate) {
      easyHrs.push(a.avgHeartRate);
      if (a.avgPace) easyPaces.push(a.avgPace);
    } else if (durationMins >= 20 && durationMins <= 45 && a.avgHeartRate) {
      if (a.avgHeartRate > 150) {
        tempoHrs.push(a.avgHeartRate);
        if (a.avgPace) tempoPaces.push(a.avgPace);
      }
    }
  }

  const prefs = (user.preferences ?? {}) as UserPreferences;
  const estimatedMaxHr = anchors.max_hr ?? (maxHrs.length > 0 ? Math.max(...maxHrs) : 190);
  const restingHr = anchors.resting_hr ?? prefs.resting_hr ?? 50;

  // Threshold HR: user-pinned anchor wins; otherwise estimate from data.
  const thrHr: HrEstimate | null =
    anchors.threshold_hr != null
      ? { value: anchors.threshold_hr, source: "manual" }
      : estimateThresholdHr(runs, estimatedMaxHr);

  const hrZones = thrHr
    ? calculateHrZonesFromThreshold(thrHr.value, estimatedMaxHr, restingHr)
    : calculateHrZonesFromMax(estimatedMaxHr, restingHr);

  // Threshold pace (always returned with a source label)
  const thrPace = estimateThresholdPace(runs, restingHr, estimatedMaxHr);
  const thresholdPace = thrPace?.value ?? 300; // Fallback default
  const paceZones = calculatePaceZonesFromThreshold(thresholdPace);

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  return {
    success: true,
    activities_analyzed: runs.length,
    date_range_start: cutoff,
    date_range_end: new Date(),
    max_hr: estimatedMaxHr,
    resting_hr: restingHr,
    threshold_hr: thrHr?.value,
    threshold_hr_source: thrHr?.source,
    threshold_pace: thresholdPace,
    threshold_pace_source: thrPace?.source,
    hr_zones: hrZones,
    pace_zones: paceZones,
    avg_hr_easy_runs: avg(easyHrs),
    avg_hr_tempo_runs: avg(tempoHrs),
    avg_pace_easy_runs: avg(easyPaces),
    avg_pace_tempo_runs: avg(tempoPaces),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface SaveZonesPayload {
  activities_analyzed?: number | null;
  date_range_start?: Date | null;
  date_range_end?: Date | null;
  max_hr?: number | null;
  resting_hr?: number | null;
  threshold_hr?: number | null;
  threshold_pace?: number | null;
  hr_zones?: ZoneMap | null;
  pace_zones?: ZoneMap | null;
  ftp?: number | null;
  cycling_power_zones?: ZoneMap | null;
  avg_hr_easy_runs?: number | null;
  avg_hr_tempo_runs?: number | null;
  avg_pace_easy_runs?: number | null;
  avg_pace_tempo_runs?: number | null;
  notes?: string | null;
}

export async function saveZonesToHistory(
  user: User,
  payload: SaveZonesPayload,
  source: string,
): Promise<void> {
  // The zone_history table doesn't have a threshold_hr column (would need a
  // migration). Until then we tuck it into `notes` as a kv-pair so it's
  // recoverable on revert.
  let notes = payload.notes ?? null;
  if (payload.threshold_hr != null) {
    const tag = `threshold_hr=${payload.threshold_hr}`;
    notes = notes ? `${notes}; ${tag}` : tag;
  }

  await db.insert(zoneHistory).values({
    userId: user.id,
    source,
    activitiesAnalyzed: payload.activities_analyzed ?? null,
    dateRangeStart: payload.date_range_start ?? null,
    dateRangeEnd: payload.date_range_end ?? null,
    maxHr: payload.max_hr ?? null,
    restingHr: payload.resting_hr ?? null,
    hrZones: (payload.hr_zones ?? null) as unknown,
    thresholdPace: payload.threshold_pace ?? null,
    paceZones: (payload.pace_zones ?? null) as unknown,
    ftp: payload.ftp ?? null,
    cyclingPowerZones: (payload.cycling_power_zones ?? null) as unknown,
    avgHrEasyRuns: payload.avg_hr_easy_runs ?? null,
    avgHrTempoRuns: payload.avg_hr_tempo_runs ?? null,
    avgPaceEasyRuns: payload.avg_pace_easy_runs ?? null,
    avgPaceTempoRuns: payload.avg_pace_tempo_runs ?? null,
    notes,
  });
}

export async function applyZonesToUser(
  user: User,
  args: {
    hr_zones: ZoneMap;
    pace_zones: ZoneMap;
    max_hr?: number;
    resting_hr?: number;
    threshold_hr?: number;
    threshold_pace?: number;
    threshold_hr_source?: ThresholdHrSource;
    threshold_pace_source?: ThresholdPaceSource;
  },
): Promise<UserPreferences> {
  const prefs: UserPreferences = { ...(user.preferences ?? {}) } as UserPreferences;
  prefs.hr_zones = args.hr_zones;
  prefs.pace_zones = args.pace_zones;
  if (args.max_hr) prefs.max_hr = args.max_hr;
  if (args.resting_hr) prefs.resting_hr = args.resting_hr;
  if (args.threshold_hr) prefs.threshold_hr = args.threshold_hr;
  if (args.threshold_pace) prefs.threshold_pace = args.threshold_pace;
  if (args.threshold_hr_source) prefs.threshold_hr_source = args.threshold_hr_source;
  if (args.threshold_pace_source) prefs.threshold_pace_source = args.threshold_pace_source;

  await db.update(users).set({ preferences: prefs, updatedAt: new Date() }).where(eq(users.id, user.id));
  return prefs;
}

export async function getZoneHistoryForUser(user: User, limit = 10) {
  return db
    .select()
    .from(zoneHistory)
    .where(eq(zoneHistory.userId, user.id))
    .orderBy(desc(zoneHistory.calculatedAt))
    .limit(limit);
}
