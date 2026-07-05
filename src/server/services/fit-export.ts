import "server-only";
import { Encoder } from "@garmin/fitsdk";
import { resolveHrZoneBpm } from "@/server/services/zones";
import type { UserPreferences } from "@/server/db/schema";

export interface WorkoutDetailsLike {
  type: string;
  description?: string;
  distance_km?: number | null;
  duration_min?: number | null;
  pace_range?: string | null;
  hr_zone?: string | null;
  intervals?: Array<{
    reps?: number;
    distance_m?: number;
    duration_sec?: number;
    target_pace?: string;
    recovery?: string;
  }> | null;
}

export interface UserPrefsLike {
  max_hr?: number;
  resting_hr?: number;
  /** Optional full prefs blob — if present, user-edited HR zones are honored. */
  hr_zones?: UserPreferences["hr_zones"];
}

// FIT message numbers (from profile.js)
const MESG_FILE_ID = 0;
const MESG_WORKOUT = 26;
const MESG_WORKOUT_STEP = 27;

// Step intensity → FIT enum string
type Intensity = "active" | "rest" | "warmup" | "cooldown" | "recovery" | "interval";

interface BasicStep {
  type: "basic";
  intensity: Intensity;
  name?: string;
  durationType: "time" | "distance" | "open";
  /** seconds for time, meters for distance */
  durationValue: number;
  targetType: "open" | "speed" | "heartRate";
  /** mm/s for speed, bpm for heartRate */
  targetLow?: number;
  targetHigh?: number;
}

interface RepeatStep {
  type: "repeat";
  reps: number;
  steps: BasicStep[];
  name?: string;
}

type Step = BasicStep | RepeatStep;

// ---------------------------------------------------------------------------
// Conversion: WorkoutDetails → flat list of FIT-shaped Step records
// ---------------------------------------------------------------------------

function parsePaceSec(pace: string): number | null {
  const cleaned = pace.replace("/km", "").trim();
  const parts = cleaned.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  return m * 60 + s;
}

function paceToSpeedMmPerSec(secPerKm: number): number {
  // pace in s/km; speed in m/s = 1000 / sec/km; FIT stores in mm/s
  if (secPerKm <= 0) return 0;
  return Math.round((1000 / secPerKm) * 1000);
}

/**
 * Resolve a zone number (1-5) to a [low, high] bpm range, preferring the
 * user's stored hr_zones when present and falling back to the canonical
 * HR-reserve fractions otherwise.
 */
function hrZoneToBpm(
  zone: number,
  maxHr: number,
  restingHr: number,
  prefs: UserPrefsLike,
): [number, number] {
  const key = `zone${zone}`;
  // Build the prefs-shape passed to resolveHrZoneBpm (it checks prefs.hr_zones first).
  const resolved = resolveHrZoneBpm(
    key,
    prefs.hr_zones ? ({ hr_zones: prefs.hr_zones } as UserPreferences) : null,
    maxHr,
    restingHr,
  );
  if (resolved) return resolved;
  // Final fallback: zone1 from formula
  const fallback = resolveHrZoneBpm("zone1", null, maxHr, restingHr);
  return fallback ?? [0, 0];
}

function buildSteps(workout: WorkoutDetailsLike, prefs: UserPrefsLike): Step[] {
  const maxHr = prefs.max_hr ?? 190;
  const restingHr = prefs.resting_hr ?? 50;
  const steps: Step[] = [];

  let paceLow: number | null = null;
  let paceHigh: number | null = null;
  if (workout.pace_range) {
    const cleaned = workout.pace_range.replace("/km", "");
    const parts = cleaned.split("-");
    if (parts.length === 2) {
      paceLow = parsePaceSec(parts[0].trim());
      paceHigh = parsePaceSec(parts[1].trim());
    }
  }

  const hrZone = workout.hr_zone
    ? parseInt(workout.hr_zone.replace("zone", ""), 10)
    : null;

  if (workout.intervals && workout.intervals.length > 0) {
    steps.push({
      type: "basic",
      intensity: "warmup",
      name: "Warm Up",
      durationType: "time",
      durationValue: 600,
      targetType: "open",
    });

    for (const ivl of workout.intervals) {
      const repeatSteps: BasicStep[] = [];
      const isTime = typeof ivl.duration_sec === "number";
      const work: BasicStep = {
        type: "basic",
        intensity: "active",
        name: "Work",
        durationType: isTime ? "time" : "distance",
        durationValue: isTime ? (ivl.duration_sec ?? 0) : (ivl.distance_m ?? 400),
        targetType: "open",
      };
      if (ivl.target_pace) {
        const pace = parsePaceSec(ivl.target_pace);
        if (pace) {
          work.targetType = "speed";
          // Higher pace number = slower; speed is the inverse
          work.targetLow = paceToSpeedMmPerSec(pace + 5);
          work.targetHigh = paceToSpeedMmPerSec(pace - 5);
        }
      }
      repeatSteps.push(work);

      let recoverySec = 90;
      const rec = ivl.recovery?.toLowerCase();
      if (rec) {
        if (rec.includes("min")) {
          const n = parseInt(rec.replace("min", "").trim(), 10);
          if (Number.isFinite(n)) recoverySec = n * 60;
        } else if (rec.includes("s")) {
          const n = parseInt(rec.replace(/s|ec/g, "").trim(), 10);
          if (Number.isFinite(n)) recoverySec = n;
        }
      }
      repeatSteps.push({
        type: "basic",
        intensity: "recovery",
        name: "Recovery",
        durationType: "time",
        durationValue: recoverySec,
        targetType: "open",
      });

      steps.push({
        type: "repeat",
        reps: ivl.reps ?? 1,
        steps: repeatSteps,
        name: `${ivl.reps ?? 1}x${ivl.distance_m ?? 400}m`,
      });
    }

    steps.push({
      type: "basic",
      intensity: "cooldown",
      name: "Cool Down",
      durationType: "time",
      durationValue: 600,
      targetType: "open",
    });
    return steps;
  }

  // Simple workout: warmup + main + cooldown
  const totalDuration = ((workout.duration_min ?? 45) * 60);
  const totalDistance = (workout.distance_km ?? 0) * 1000;
  const warmup = Math.min(600, Math.floor(totalDuration / 6));
  const cooldown = warmup;
  const mainDuration = totalDuration - warmup - cooldown;

  steps.push({
    type: "basic",
    intensity: "warmup",
    name: "Warm Up",
    durationType: "time",
    durationValue: warmup,
    targetType: "open",
  });

  const main: BasicStep = {
    type: "basic",
    intensity: "active",
    name: workout.type.replace(/_/g, " "),
    durationType: totalDistance > 0 ? "distance" : "time",
    durationValue:
      totalDistance > 0 ? Math.max(totalDistance - 2000, 1000) : mainDuration,
    targetType: "open",
  };

  if (paceLow && paceHigh) {
    main.targetType = "speed";
    main.targetLow = paceToSpeedMmPerSec(paceHigh); // higher seconds → slower → lower mm/s
    main.targetHigh = paceToSpeedMmPerSec(paceLow);
  } else if (hrZone) {
    const [low, high] = hrZoneToBpm(hrZone, maxHr, restingHr, prefs);
    main.targetType = "heartRate";
    main.targetLow = low;
    main.targetHigh = high;
  }

  steps.push(main);
  steps.push({
    type: "basic",
    intensity: "cooldown",
    name: "Cool Down",
    durationType: "time",
    durationValue: cooldown,
    targetType: "open",
  });

  return steps;
}

function countTotalSteps(steps: Step[]): number {
  let count = 0;
  for (const s of steps) {
    if (s.type === "repeat") count += s.steps.length + 1;
    else count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Build a FIT workout file
// ---------------------------------------------------------------------------

function durationFieldValue(s: BasicStep): number {
  // FIT scales: time → s × 1000 (ms), distance → m × 100 (cm)
  if (s.durationType === "time") return Math.round(s.durationValue * 1000);
  if (s.durationType === "distance") return Math.round(s.durationValue * 100);
  return 0;
}

function writeBasicStep(
  encoder: Encoder,
  step: BasicStep,
  messageIndex: number,
): void {
  const mesg: { mesgNum: number } & Record<string, unknown> = {
    mesgNum: MESG_WORKOUT_STEP,
    messageIndex,
    wktStepName: step.name ? [step.name.slice(0, 16)] : undefined,
    intensity: step.intensity,
    durationType: step.durationType,
    durationValue: durationFieldValue(step),
    targetType: step.targetType,
    targetValue: 0,
  };
  if (step.targetLow != null && step.targetHigh != null) {
    mesg.customTargetValueLow = step.targetLow;
    mesg.customTargetValueHigh = step.targetHigh;
  }
  encoder.writeMesg(mesg);
}

export function buildFitWorkout(
  workout: WorkoutDetailsLike,
  prefs: UserPrefsLike,
  workoutName: string,
): Uint8Array {
  const encoder = new Encoder();

  // file_id message
  encoder.writeMesg({
    mesgNum: MESG_FILE_ID,
    type: "workout",
    manufacturer: 1, // garmin
    product: 0,
    serialNumber: 12345,
    timeCreated: new Date(),
  });

  const steps = buildSteps(workout, prefs);

  // workout header
  encoder.writeMesg({
    mesgNum: MESG_WORKOUT,
    wktName: [workoutName.slice(0, 20)],
    sport: "running",
    numValidSteps: countTotalSteps(steps),
  });

  // workout_step messages
  let messageIndex = 0;
  for (const step of steps) {
    if (step.type === "basic") {
      writeBasicStep(encoder, step, messageIndex);
      messageIndex += 1;
      continue;
    }
    // repeat: write sub-steps first, then the repeat-back step
    const firstSubIndex = messageIndex;
    for (const sub of step.steps) {
      writeBasicStep(encoder, sub, messageIndex);
      messageIndex += 1;
    }
    encoder.writeMesg({
      mesgNum: MESG_WORKOUT_STEP,
      messageIndex,
      wktStepName: step.name ? [step.name.slice(0, 16)] : undefined,
      intensity: "active",
      durationType: "repeatUntilStepsCmplt",
      durationValue: firstSubIndex, // step to loop back to
      targetType: "open",
      targetValue: step.reps,
    });
    messageIndex += 1;
  }

  return encoder.close();
}
