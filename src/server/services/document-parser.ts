import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { trainingSessions, uploadedPlans, type User } from "@/server/db/schema";
import { parseDocument } from "@/server/services/claude";
import {
  buildDocumentParsingPrompt,
  DOCUMENT_PARSING_SYSTEM,
} from "@/server/prompts/training-recommendation";

// ---------------------------------------------------------------------------
// File-type dispatch
// ---------------------------------------------------------------------------

const PDF_TYPES = new Set(["application/pdf"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse pulls in test-fixture loading at module init unless we import its
  // internal lib path directly.
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as {
    default: (data: Buffer) => Promise<{ text: string }>;
  };
  const result = await mod.default(buffer);
  return result.text;
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractTextFromFile(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<string> {
  const lcName = filename.toLowerCase();

  if (PDF_TYPES.has(contentType) || lcName.endsWith(".pdf")) {
    return extractFromPdf(buffer);
  }
  if (DOCX_TYPES.has(contentType) || lcName.endsWith(".docx") || lcName.endsWith(".doc")) {
    return extractFromDocx(buffer);
  }
  if (contentType.startsWith("text/") || lcName.endsWith(".txt") || lcName.endsWith(".md")) {
    return buffer.toString("utf-8");
  }
  throw new Error(`Unsupported file type: ${contentType || "unknown"}`);
}

// ---------------------------------------------------------------------------
// Claude-driven parse
// ---------------------------------------------------------------------------

function nextMondayIso(): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = today.getUTCDay() || 7; // 1..7 Mon..Sun
  const daysUntilMonday = ((8 - dayOfWeek) % 7) || 7;
  const next = new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export async function parseTrainingPlan(
  documentText: string,
  startDate?: string | null,
): Promise<Record<string, unknown>> {
  const start = startDate ?? nextMondayIso();
  const prompt = buildDocumentParsingPrompt(documentText, start);
  const result = await parseDocument(DOCUMENT_PARSING_SYSTEM, prompt);
  if (result.error) return { error: result.error };
  return result.data ?? {};
}

// ---------------------------------------------------------------------------
// normalizeWorkout — fill in missing structured fields from the description.
// Used to ensure every parsed session has type/sport/intensity/distance/
// duration/pace populated, even when Claude returns a sparse record.
// ---------------------------------------------------------------------------

// Order matters: check the most specific markers first. "Interval" must
// precede "recovery" because interval sessions routinely say "90s recovery".
// "Tempo" must precede "long_run" because "long tempo" → tempo, not long.
const TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(rest\s*day|complete\s+rest)\b/i, "rest"],
  [/\b(interval|reps?|repetition|fartlek|track\s*session|VO2|hill\s*sprint|\d+\s*[x×]\s*\d+\s*m?\b)/i, "interval"],
  [/\btempo\b|\bthreshold\b|\bLT[12]?\b/i, "tempo"],
  [/\blong\s*run\b|\bLSD\b/i, "long_run"],
  [/\brecovery\b|\brecov\b/i, "recovery"],
  [/\brest\b/i, "rest"],
  [/\bcross[\s-]?training\b|\bboulder|\bclimb|\byoga\b|\bcore\b|\bstrength\b|\bgym\b|\bweights\b|\bswim\b|\bbike\b|\bride\b|\bcycle\b/i, "cross_training"],
  [/\beasy\b|\bjog\b|\bshakeout\b/i, "easy"],
];

// Pace-based fallback: if no keyword matched and the description has a fast
// pace, classify by speed. This catches "3 km WU + 6 km @ 4:00–4:05 + 2 km CD"
// type descriptions that don't use the word "tempo".
const PACE_FALLBACK_THRESHOLDS: Array<{ maxSec: number; type: string }> = [
  { maxSec: 235, type: "interval" }, // ≤ 3:55/km → interval
  { maxSec: 270, type: "tempo" }, // ≤ 4:30/km → tempo
];

const SPORT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ride|bike|cycling|spin|MTB|gravel)\b/i, "cycling"],
  [/\b(swim|pool|laps)\b/i, "swimming"],
  [/\b(strength|gym|weights|core|lift|squat|deadlift)\b/i, "strength"],
  [/\b(hike|hiking|walk)\b/i, "hiking"],
  [/\b(row|rowing|erg)\b/i, "rowing"],
];

const INTENSITY_BY_TYPE: Record<string, "low" | "moderate" | "high"> = {
  easy: "low",
  recovery: "low",
  long_run: "low",
  rest: "low",
  cross_training: "low",
  tempo: "moderate",
  interval: "high",
  race: "high",
};

const HR_ZONE_BY_INTENSITY: Record<string, string> = {
  low: "zone2",
  moderate: "zone3",
  high: "zone4",
};

const DEFAULT_PACE_BY_TYPE: Record<string, string> = {
  easy: "5:00-5:30",
  recovery: "5:20-5:50",
  long_run: "5:00-5:30",
  tempo: "4:20-4:40",
  interval: "3:30-3:55",
};

function paceMidpointSeconds(paceRange: string | undefined): number | null {
  if (!paceRange) return null;
  const cleaned = paceRange.replace("/km", "").trim();
  const parts = cleaned.split(/[–\-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const parsePart = (p: string): number | null => {
    const m = p.match(/^(\d+):(\d{1,2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const first = parsePart(parts[0]);
  if (first == null) return null;
  if (parts.length === 1) return first;
  const second = parsePart(parts[1]);
  if (second == null) return first;
  return Math.round((first + second) / 2);
}

function extractDistanceKm(text: string): number | null {
  // Match "10km", "10 km", "10.5km", "10,5 km"
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractPaceRange(text: string): string | null {
  // Match "@ 3:22/km", "4:30-4:45/km", "5:00–5:30/km" (en-dash too)
  const ranged = text.match(/(\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2})\s*\/?\s*km/i);
  if (ranged) return ranged[1].replace(/\s+/g, "").replace("–", "-");
  // "@ 4:00–4:05" without /km suffix (common in plan descriptions)
  const atRange = text.match(/@\s*(\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2})/);
  if (atRange) return atRange[1].replace(/\s+/g, "").replace("–", "-");
  const single = text.match(/(?:@|at)\s*(\d{1,2}:\d{2})\s*\/?\s*km/i);
  if (single) return single[1];
  return null;
}

/**
 * Fill in missing fields from the description so every workout has at minimum
 * type, sport, intensity, and a hr_zone. Distance/duration are inferred only
 * when derivable; pace_range only when present in text.
 */
export function normalizeWorkout(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const description = typeof raw.description === "string" ? raw.description : "";
  const out: Record<string, unknown> = { ...raw };

  // ─ Type ─
  if (typeof out.type !== "string" || !out.type) {
    out.type = "easy";
    let matched = false;
    for (const [pat, type] of TYPE_PATTERNS) {
      if (pat.test(description)) {
        out.type = type;
        matched = true;
        break;
      }
    }
    // Pace-based fallback: if no keyword matched, infer from pace if a fast pace
    // is mentioned in the description.
    if (!matched) {
      const pace = extractPaceRange(description);
      const paceSec = paceMidpointSeconds(pace ?? undefined);
      if (paceSec != null) {
        for (const { maxSec, type } of PACE_FALLBACK_THRESHOLDS) {
          if (paceSec <= maxSec) {
            out.type = type;
            break;
          }
        }
      }
    }
  }
  const type = out.type as string;

  // ─ Sport ─
  if (typeof out.sport !== "string" || !out.sport) {
    let sport = "running";
    for (const [pat, s] of SPORT_PATTERNS) {
      if (pat.test(description)) {
        sport = s;
        break;
      }
    }
    out.sport = sport;
  }

  // ─ Distance ─
  if (typeof out.distance_km !== "number" || !Number.isFinite(out.distance_km)) {
    const fromDesc = extractDistanceKm(description);
    if (fromDesc != null && type !== "rest" && out.sport !== "strength") {
      out.distance_km = fromDesc;
    }
  }

  // ─ Pace range ─
  if (typeof out.pace_range !== "string" || !out.pace_range) {
    const fromDesc = extractPaceRange(description);
    if (fromDesc) {
      out.pace_range = fromDesc;
    } else if (out.sport === "running" && type in DEFAULT_PACE_BY_TYPE) {
      out.pace_range = DEFAULT_PACE_BY_TYPE[type];
    }
  }

  // ─ Intensity ─
  if (typeof out.intensity !== "string" || !out.intensity) {
    out.intensity = INTENSITY_BY_TYPE[type] ?? "moderate";
  }

  // ─ HR zone ─
  if (typeof out.hr_zone !== "string" || !out.hr_zone) {
    out.hr_zone = HR_ZONE_BY_INTENSITY[out.intensity as string] ?? "zone3";
  }

  // ─ Duration ─ (compute from distance + pace if missing)
  if (typeof out.duration_min !== "number" || !Number.isFinite(out.duration_min)) {
    const km = typeof out.distance_km === "number" ? out.distance_km : null;
    const paceSec = paceMidpointSeconds(out.pace_range as string | undefined);
    if (km != null && paceSec != null && type !== "rest") {
      out.duration_min = Math.round((km * paceSec) / 60);
    } else if (type === "rest") {
      // leave undefined
    } else if (type === "cross_training" || out.sport === "strength") {
      // sensible default for unmeasured sessions
      out.duration_min = 45;
    }
  }

  // Drop undefineds so the stored JSON is tidy
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Structured workout builder (mirrors create_structured_workout_from_data)
// ---------------------------------------------------------------------------

interface IntervalShape {
  reps?: number;
  distance_m?: number;
  duration_sec?: number;
  target_pace?: string;
  recovery?: string;
}

function parsePaceSeconds(pace: string): number | null {
  const cleaned = pace.replace("/km", "").trim();
  const parts = cleaned.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  return m * 60 + s;
}

function parseRecoverySeconds(rec: string | undefined): number {
  if (!rec) return 90;
  const lower = rec.toLowerCase();
  try {
    if (lower.includes("min")) {
      const n = parseInt(lower.replace("min", "").trim(), 10);
      if (Number.isFinite(n)) return n * 60;
    }
    if (lower.includes("s")) {
      const n = parseInt(lower.replace(/s|ec/g, "").trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // fall through
  }
  return 90;
}

export function createStructuredWorkout(
  workout: Record<string, unknown>,
  sessionDate: string,
): Record<string, unknown> {
  const type = typeof workout.type === "string" ? workout.type : "easy";
  const description = typeof workout.description === "string" ? workout.description : "";
  const intervals = Array.isArray(workout.intervals) ? (workout.intervals as IntervalShape[]) : [];
  const distanceKm = typeof workout.distance_km === "number" ? workout.distance_km : null;
  const durationMin = typeof workout.duration_min === "number" ? workout.duration_min : null;
  const paceRange = typeof workout.pace_range === "string" ? workout.pace_range : null;
  const hrZone = typeof workout.hr_zone === "string" ? workout.hr_zone : null;

  const dt = new Date(`${sessionDate}T00:00:00Z`);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  let workoutName = `${mm}/${dd} ${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
  if (workoutName.length > 20) workoutName = workoutName.slice(0, 20);

  let paceLow: number | null = null;
  let paceHigh: number | null = null;
  if (paceRange) {
    const cleaned = paceRange.replace("/km", "");
    const parts = cleaned.split("-");
    if (parts.length >= 1) paceLow = parsePaceSeconds(parts[0]);
    if (parts.length >= 2) paceHigh = parsePaceSeconds(parts[1]);
  }

  let targetZone: number | null = null;
  if (hrZone) {
    const z = parseInt(hrZone.replace("zone", ""), 10);
    if (Number.isFinite(z)) targetZone = z;
  }

  const steps: Record<string, unknown>[] = [];

  if (intervals.length > 0) {
    steps.push({
      step_type: "warmup",
      name: "Warm Up",
      duration_type: "time",
      duration_value: 600,
      target_type: "open",
    });

    for (const ivl of intervals) {
      const repeatSteps: Record<string, unknown>[] = [];
      const workDurationType = ivl.duration_sec ? "time" : "distance";
      const workDuration = ivl.duration_sec ?? ivl.distance_m ?? 400;

      let workTargetType: "pace" | "open" = "open";
      let workTargetLow: number | null = null;
      let workTargetHigh: number | null = null;
      if (ivl.target_pace) {
        const sec = parsePaceSeconds(ivl.target_pace);
        if (sec) {
          workTargetType = "pace";
          workTargetLow = sec - 5;
          workTargetHigh = sec + 5;
        }
      }

      const workStep: Record<string, unknown> = {
        step_type: "active",
        name: "Work",
        duration_type: workDurationType,
        duration_value: workDuration,
        target_type: workTargetType,
      };
      if (workTargetLow != null) {
        workStep.target_value_low = workTargetLow;
        workStep.target_value_high = workTargetHigh;
      }
      repeatSteps.push(workStep);

      repeatSteps.push({
        step_type: "recovery",
        name: "Recovery",
        duration_type: "time",
        duration_value: parseRecoverySeconds(ivl.recovery),
        target_type: "open",
      });

      const reps = ivl.reps ?? 1;
      steps.push({
        step_type: "repeat",
        name: `${reps}x${ivl.distance_m ?? "?"}m`,
        repeat_count: reps,
        repeat_steps: repeatSteps,
      });
    }

    steps.push({
      step_type: "cooldown",
      name: "Cool Down",
      duration_type: "time",
      duration_value: 600,
      target_type: "open",
    });
  } else {
    const totalDuration = (durationMin ?? 45) * 60;
    const totalDistance = (distanceKm ?? 0) * 1000;
    const warmupDuration = Math.min(600, Math.floor(totalDuration / 6));
    const cooldownDuration = warmupDuration;
    const mainDuration = totalDuration - warmupDuration - cooldownDuration;

    steps.push({
      step_type: "warmup",
      name: "Warm Up",
      duration_type: "time",
      duration_value: warmupDuration,
      target_type: "open",
    });

    const mainStep: Record<string, unknown> = {
      step_type: "active",
      name: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };

    if (totalDistance > 0) {
      const mainDistance = Math.max(totalDistance - 2000, 1000);
      mainStep.duration_type = "distance";
      mainStep.duration_value = mainDistance;
    } else {
      mainStep.duration_type = "time";
      mainStep.duration_value = mainDuration;
    }

    if (paceLow && paceHigh) {
      mainStep.target_type = "pace";
      mainStep.target_value_low = paceLow;
      mainStep.target_value_high = paceHigh;
    } else if (targetZone) {
      mainStep.target_type = "heart_rate_zone";
      mainStep.target_zone = targetZone;
    } else {
      mainStep.target_type = "open";
    }

    steps.push(mainStep);
    steps.push({
      step_type: "cooldown",
      name: "Cool Down",
      duration_type: "time",
      duration_value: cooldownDuration,
      target_type: "open",
    });
  }

  return {
    name: workoutName,
    sport: "running",
    description,
    steps,
    estimated_duration_min: durationMin,
    estimated_distance_km: distanceKm,
  };
}

// ---------------------------------------------------------------------------
// process_uploaded_plan — orchestrates extract → Claude parse → DB write
// ---------------------------------------------------------------------------

export async function processUploadedPlan(
  user: User,
  buffer: Buffer,
  contentType: string,
  filename: string,
  startDate?: string | null,
): Promise<{ id: number; filename: string; is_active: boolean; parsed_sessions_count: number; upload_date: string }> {
  const documentText = await extractTextFromFile(buffer, contentType, filename);
  const parsed = await parseTrainingPlan(documentText, startDate ?? null);
  if (typeof parsed === "object" && parsed !== null && "error" in parsed && typeof parsed.error === "string") {
    throw new Error(parsed.error);
  }

  const parsedSessions = Array.isArray(parsed.sessions) ? (parsed.sessions as unknown[]) : [];

  const [plan] = await db
    .insert(uploadedPlans)
    .values({
      userId: user.id,
      filename,
      contentType,
      contentText: documentText,
      parsedSessions,
      isActive: 1,
    })
    .returning();

  for (const raw of parsedSessions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const data = raw as Record<string, unknown>;
    const dateValue = data.date;
    if (typeof dateValue !== "string") continue;

    const rawWorkout: Record<string, unknown> = {
      type: typeof data.type === "string" ? data.type : undefined,
      sport: typeof data.sport === "string" ? data.sport : undefined,
      description: typeof data.description === "string" ? data.description : "",
      distance_km: typeof data.distance_km === "number" ? data.distance_km : undefined,
      duration_min: typeof data.duration_min === "number" ? data.duration_min : undefined,
      intensity: typeof data.intensity === "string" ? data.intensity : undefined,
      hr_zone: typeof data.hr_zone === "string" ? data.hr_zone : undefined,
      pace_range: typeof data.pace_range === "string" ? data.pace_range : undefined,
      intervals: Array.isArray(data.intervals) ? data.intervals : undefined,
      notes: typeof data.notes === "string" ? data.notes : undefined,
    };
    const workoutData = normalizeWorkout(rawWorkout);
    workoutData.structured = createStructuredWorkout(workoutData, dateValue);

    const existing = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, user.id),
          eq(trainingSessions.sessionDate, dateValue),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(trainingSessions)
        .set({
          plannedWorkout: workoutData,
          source: "uploaded_plan",
          uploadedPlanId: plan.id,
          updatedAt: new Date(),
        })
        .where(eq(trainingSessions.id, existing[0].id));
    } else {
      await db.insert(trainingSessions).values({
        userId: user.id,
        sessionDate: dateValue,
        source: "uploaded_plan",
        plannedWorkout: workoutData,
        uploadedPlanId: plan.id,
      });
    }
  }

  return {
    id: plan.id,
    filename: plan.filename,
    is_active: Boolean(plan.isActive),
    parsed_sessions_count: parsedSessions.length,
    upload_date: plan.uploadDate.toISOString(),
  };
}
