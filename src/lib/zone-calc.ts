// Pure zone math shared between server (zones service) and client (settings
// page "Calc Zones" buttons). Must stay free of server-only imports.

export type ZoneRange = { min: number; max: number; name?: string };
export type ZoneMap = Record<string, ZoneRange>;

export const HR_ZONE_FRACTIONS = {
  zone1: { low: 0.5, high: 0.6, name: "Active Recovery" },
  zone2: { low: 0.6, high: 0.7, name: "Endurance" },
  zone3: { low: 0.7, high: 0.8, name: "Tempo" },
  zone4: { low: 0.8, high: 0.9, name: "Threshold" },
  zone5: { low: 0.9, high: 1.0, name: "Anaerobic" },
} as const;

export type HrZoneKey = keyof typeof HR_ZONE_FRACTIONS;

/** 5 HR zones from max HR + resting HR using HR-reserve (Karvonen). */
export function calculateHrZonesFromMax(maxHr: number, restingHr = 50): ZoneMap {
  const hrr = maxHr - restingHr;
  const at = (pct: number) => Math.floor(restingHr + (hrr * pct) / 100);
  return {
    zone1: { min: at(50), max: at(60), name: HR_ZONE_FRACTIONS.zone1.name },
    zone2: { min: at(60) + 1, max: at(70), name: HR_ZONE_FRACTIONS.zone2.name },
    zone3: { min: at(70) + 1, max: at(80), name: HR_ZONE_FRACTIONS.zone3.name },
    zone4: { min: at(80) + 1, max: at(90), name: HR_ZONE_FRACTIONS.zone4.name },
    zone5: { min: at(90) + 1, max: maxHr, name: HR_ZONE_FRACTIONS.zone5.name },
  };
}

/**
 * 5 HR zones with zone4.high anchored to threshold HR. Other zones are scaled
 * proportionally to threshold HR + max HR. This matches the common training
 * convention that lactate-threshold HR sits at the top of zone 4.
 */
export function calculateHrZonesFromThreshold(
  thresholdHr: number,
  maxHr: number,
  restingHr = 50,
): ZoneMap {
  // Anchor: zone4.max == threshold HR. Keep the same fractional spacing
  // relative to (thresholdHr - restingHr) for zones 1-4, treating threshold
  // as the "0.90 point" of HR-reserve.
  const hrrThreshold = thresholdHr - restingHr;
  if (hrrThreshold <= 0) return calculateHrZonesFromMax(maxHr, restingHr);

  const at = (pct: number) => Math.floor(restingHr + (hrrThreshold * pct) / 90);
  return {
    zone1: { min: at(50), max: at(60), name: HR_ZONE_FRACTIONS.zone1.name },
    zone2: { min: at(60) + 1, max: at(70), name: HR_ZONE_FRACTIONS.zone2.name },
    zone3: { min: at(70) + 1, max: at(80), name: HR_ZONE_FRACTIONS.zone3.name },
    zone4: { min: at(80) + 1, max: thresholdHr, name: HR_ZONE_FRACTIONS.zone4.name },
    zone5: { min: thresholdHr + 1, max: maxHr, name: HR_ZONE_FRACTIONS.zone5.name },
  };
}

/** 7 cycling power zones (Coggan model) from FTP. */
export function calculateCyclingPowerZonesFromFtp(ftp: number): ZoneMap {
  const at = (pct: number) => Math.floor((ftp * pct) / 100);
  return {
    zone1: { min: 0, max: at(55), name: "Active Recovery" },
    zone2: { min: at(55) + 1, max: at(75), name: "Endurance" },
    zone3: { min: at(75) + 1, max: at(90), name: "Tempo" },
    zone4: { min: at(90) + 1, max: at(105), name: "Threshold" },
    zone5: { min: at(105) + 1, max: at(120), name: "VO2 Max" },
    zone6: { min: at(120) + 1, max: at(150), name: "Anaerobic" },
    zone7: { min: at(150) + 1, max: at(200), name: "Neuromuscular" },
  };
}

/**
 * 6 pace zones from threshold pace (seconds/km). Convention: `min` is the
 * SLOWER bound (higher seconds/km), `max` is the FASTER bound (lower
 * seconds/km). Boundaries are `+1` on the slower side so adjacent zones don't
 * share a value (zone N max + 1 == zone N+1 min, with zone N max < zone N min
 * because pace is inverse).
 */
export function calculatePaceZonesFromThreshold(thresholdPace: number): ZoneMap {
  const at = (pct: number) => Math.floor((thresholdPace * pct) / 100);
  return {
    zone1: { min: at(135), max: at(115) + 1, name: "Active Recovery" },
    zone2: { min: at(115), max: at(105) + 1, name: "Endurance" },
    zone3: { min: at(105), max: at(100) + 1, name: "Tempo" },
    zone4: { min: at(100), max: at(95) + 1, name: "Threshold" },
    zone5: { min: at(95), max: at(85) + 1, name: "VO2 Max" },
    zone6: { min: at(85), max: at(75), name: "Anaerobic" },
  };
}
