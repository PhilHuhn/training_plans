import "server-only";
import type { UserPreferences } from "@/server/db/schema";
import { HR_ZONE_FRACTIONS, hrZoneMidpoint } from "@/server/services/zones";

/**
 * Bannister TRIMP (Training Impulse).
 *   TRIMP = duration_min * dHR_ratio * k * exp(b * dHR_ratio)
 * Male:   k=0.64, b=1.92.  Female: k=0.86, b=1.67.
 */
export function calculateTrimp(
  durationSeconds: number | null | undefined,
  avgHr: number | null | undefined,
  restingHr: number | null | undefined,
  maxHr: number | null | undefined,
  gender: "male" | "female" = "male",
): number {
  if (!durationSeconds || !avgHr || !restingHr || !maxHr) return 0;
  const durationMin = durationSeconds / 60;
  const hrReserve = maxHr - restingHr;
  if (hrReserve <= 0) return 0;
  const ratioRaw = (avgHr - restingHr) / hrReserve;
  const ratio = Math.max(0, Math.min(1, ratioRaw));
  const k = gender === "female" ? 0.86 : 0.64;
  const b = gender === "female" ? 1.67 : 1.92;
  return durationMin * ratio * k * Math.exp(b * ratio);
}

const INTENSITY_FRACTION: Record<string, number> = {
  low: 0.55,
  moderate: 0.72,
  high: 0.88,
};

/**
 * Estimate TRIMP for a planned workout.
 *
 * Resolution order for the proxy avg-HR:
 *   1. If `hrZone` resolves through `prefs.hr_zones`, use the midpoint of that
 *      bpm range. This is exact: the value matches what calculateTrimp() will
 *      produce when the user actually trains in the zone.
 *   2. Else if `hrZone` matches the formula-derived zones, use the midpoint of
 *      the HR_ZONE_FRACTIONS range applied to (max_hr − resting_hr).
 *   3. Else fall back to a coarse intensity-based fraction.
 */
export function estimatePlannedLoad(
  durationMin: number | null | undefined,
  intensity: string | null | undefined,
  hrZone: string | null | undefined,
  restingHr: number | null | undefined,
  maxHr: number | null | undefined,
  prefs?: UserPreferences | null,
): number {
  if (!durationMin || !restingHr || !maxHr) return 0;
  if (maxHr <= restingHr) return 0;

  // Tier 1+2: zone-based via hrZoneMidpoint (which checks prefs first, then formula).
  if (hrZone) {
    const mid = hrZoneMidpoint(hrZone, prefs ?? null, maxHr, restingHr);
    if (mid != null) {
      return calculateTrimp(durationMin * 60, mid, restingHr, maxHr);
    }
    // hrZone string didn't match anything we know — fall through to intensity.
  }

  // Tier 3: intensity-based fraction.
  const fraction = INTENSITY_FRACTION[intensity ?? ""] ?? 0.6;
  const estimatedAvgHr = restingHr + fraction * (maxHr - restingHr);
  return calculateTrimp(durationMin * 60, estimatedAvgHr, restingHr, maxHr);
}

// Re-export the canonical fractions table for any consumer that needs it.
export { HR_ZONE_FRACTIONS };
