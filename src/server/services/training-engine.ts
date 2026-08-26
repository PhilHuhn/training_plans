import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  competitions,
  trainingSessions,
  type Activity,
  type Competition,
  type TrainingSession,
  type User,
  type UserPreferences,
} from "@/server/db/schema";
import { calculateTrimp } from "@/server/services/training-load";
import { resolveEffectiveWorkout } from "@/server/services/workout-normalize";
import {
  convertSession as claudeConvert,
  generateTrainingRecommendations,
  type GenerationProgressCallback,
} from "@/server/services/claude";
import { formatGoalTime, formatPace } from "@/server/services/pace";
import {
  buildPlanConversionPrompt,
  buildTrainingRecommendationPrompt,
  PLAN_CONVERSION_SYSTEM,
  TRAINING_RECOMMENDATION_SYSTEM,
} from "@/server/prompts/training-recommendation";

// ---------------------------------------------------------------------------
// Helpers for prompt formatting
// ---------------------------------------------------------------------------

const RUN_TYPES = new Set(["run", "running", "trail run", "treadmill"]);
const RIDE_TYPES = new Set(["ride", "cycling", "virtualride", "virtual ride"]);

interface ZoneEntry {
  min?: number;
  max?: number;
  name?: string;
}

function formatHrZones(hrZones: Record<string, ZoneEntry> | undefined): string {
  if (!hrZones || Object.keys(hrZones).length === 0) return "Default zones";
  return Object.entries(hrZones)
    .map(([zone, data]) =>
      `- ${zone}: ${data.min ?? 0}-${data.max ?? 0} bpm (${data.name ?? zone})`,
    )
    .join("\n");
}

function formatPaceZones(paceZones: Record<string, ZoneEntry> | undefined): string {
  if (!paceZones || Object.keys(paceZones).length === 0) return "Default zones";
  return Object.entries(paceZones)
    .map(([zone, data]) =>
      `- ${zone}: ${formatPace(data.min ?? 0)}-${formatPace(data.max ?? 0)}/km (${data.name ?? zone})`,
    )
    .join("\n");
}

function formatPowerZones(powerZones: Record<string, ZoneEntry> | undefined): string {
  if (!powerZones || Object.keys(powerZones).length === 0) return "Not configured (no FTP set)";
  return Object.entries(powerZones)
    .map(([zone, data]) =>
      `- ${zone}: ${data.min ?? 0}-${data.max ?? 0}W (${data.name ?? zone})`,
    )
    .join("\n");
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

// ---------------------------------------------------------------------------
// generate_recommendations
// ---------------------------------------------------------------------------

export interface GenerateInput {
  user: User;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  considerFixedPlan?: boolean;
  allowedSports?: string[] | null;
  sportAvailability?: Record<string, { start_date?: string }> | null;
}

export async function generateRecommendations(
  input: GenerateInput,
  onProgress?: GenerationProgressCallback,
): Promise<Record<string, unknown>> {
  const { user, startDate, endDate, considerFixedPlan = true, allowedSports = null, sportAvailability = null } = input;
  const prefs = (user.preferences ?? {}) as UserPreferences;

  // Recent activities (30 days)
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, user.id), gte(activities.startDate, cutoff30)))
    .orderBy(desc(activities.startDate));

  // Weekly stats (7 days)
  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const week = recent.filter((a) => a.startDate >= cutoff7);
  const weeklyDistance = week.reduce((s, a) => s + (a.distance ?? 0), 0) / 1000;
  const weeklyDuration = week.reduce((s, a) => s + (a.duration ?? 0), 0) / 3600;
  const weeklyAvgHr = week.length
    ? week.reduce((s, a) => s + (a.avgHeartRate ?? 0), 0) / week.length
    : 0;
  const weeklyRuns = week.filter((a) => RUN_TYPES.has((a.activityType ?? "").toLowerCase())).length;
  const weeklyRides = week.filter((a) => RIDE_TYPES.has((a.activityType ?? "").toLowerCase())).length;
  const weeklyOther = week.length - weeklyRuns - weeklyRides;

  // Upcoming competitions (within range, plus 14 days)
  const compsEnd = isoOf(new Date(dateFromIso(endDate).getTime() + 14 * 24 * 60 * 60 * 1000));
  const upcoming = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.userId, user.id),
        gte(competitions.raceDate, startDate),
        lte(competitions.raceDate, compsEnd),
      ),
    )
    .orderBy(asc(competitions.raceDate));

  // Fixed plan
  let fixedPlanText = "No fixed training plan.";
  if (considerFixedPlan) {
    const fixed = await db
      .select()
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, user.id),
          gte(trainingSessions.sessionDate, startDate),
          lte(trainingSessions.sessionDate, endDate),
          isNotNull(trainingSessions.plannedWorkout),
        ),
      )
      .orderBy(asc(trainingSessions.sessionDate));
    if (fixed.length > 0) {
      fixedPlanText = fixed
        .map((s) => {
          const w = (s.plannedWorkout ?? {}) as Record<string, unknown>;
          const desc = typeof w.description === "string" ? w.description : "No description";
          return `- ${s.sessionDate}: ${desc}`;
        })
        .join("\n");
    }
  }

  // Format recent activities (top 15)
  const activitiesText =
    recent.length === 0
      ? "No recent activities."
      : recent
          .slice(0, 15)
          .map(
            (a: Activity) =>
              `- ${a.startDate.toISOString().slice(0, 10)}: [${a.activityType ?? "Run"}] ${a.name} - ` +
              `${((a.distance ?? 0) / 1000).toFixed(1)}km, ` +
              `${formatPace(a.avgPace)}/km, ` +
              `HR: ${a.avgHeartRate ?? "N/A"}bpm`,
          )
          .join("\n");

  // Competitions text
  const competitionsText =
    upcoming.length === 0
      ? "No upcoming competitions."
      : upcoming
          .map((c: Competition) => {
            const daysUntil = Math.round(
              (dateFromIso(c.raceDate as unknown as string).getTime() - dateFromIso(startDate).getTime()) /
                (24 * 60 * 60 * 1000),
            );
            return (
              `- ${c.raceDate}: ${c.name} (${c.raceType}) - ` +
              `Priority: ${c.priority}, ` +
              `Goal: ${formatGoalTime(c.goalTime)}, ` +
              `Days until: ${daysUntil}`
            );
          })
          .join("\n");

  // Zones
  const hrZonesText = formatHrZones(prefs.hr_zones);
  const paceZonesText = formatPaceZones(prefs.pace_zones);
  const powerZonesText = formatPowerZones(prefs.cycling_power_zones);
  const ftpText = prefs.ftp ? `${prefs.ftp}W` : "Not set";

  // Weekly TRIMP for last 4 weeks
  const restingHr = prefs.resting_hr ?? 50;
  const maxHr = prefs.max_hr ?? 190;
  const trimpLines: string[] = [];
  for (let off = 0; off < 4; off++) {
    const wEnd = new Date(Date.now() - off * 7 * 24 * 60 * 60 * 1000);
    const wStart = new Date(wEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const wActs = recent.filter((a) => a.startDate >= wStart && a.startDate < wEnd);
    const wTrimp = wActs.reduce((s, a) => {
      if (!a.avgHeartRate || !a.duration) return s;
      return s + calculateTrimp(a.duration, a.avgHeartRate, restingHr, maxHr);
    }, 0);
    trimpLines.push(`- Week -${off + 1}: ${wTrimp.toFixed(0)} TRIMP (${wActs.length} sessions)`);
  }

  // Recent RPE feedback
  const rpeStart = isoOf(new Date(dateFromIso(startDate).getTime() - 14 * 24 * 60 * 60 * 1000));
  const rpeRows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, user.id),
        isNotNull(trainingSessions.rpeActual),
        gte(trainingSessions.sessionDate, rpeStart),
      ),
    )
    .orderBy(desc(trainingSessions.sessionDate))
    .limit(10);
  const rpeText =
    rpeRows.length === 0
      ? "No RPE feedback yet."
      : rpeRows
          .map((rs: TrainingSession) => {
            // Expanded: a stored recommendation carries `rpe`, not
            // `rpe_target`, so reading it raw told the coach "no target" for
            // every session it had itself prescribed.
            const workout = (resolveEffectiveWorkout(rs) ?? {}) as Record<string, unknown>;
            const target = workout.rpe_target;
            const targetStr = typeof target === "number" ? `target=${target}` : "no target";
            return `- ${rs.sessionDate}: actual=${rs.rpeActual} (${targetStr})`;
          })
          .join("\n");

  // Planning weeks
  const planningDays = Math.round(
    (dateFromIso(endDate).getTime() - dateFromIso(startDate).getTime()) / (24 * 60 * 60 * 1000),
  );
  const planningWeeks = Math.floor(planningDays / 7);

  const thresholdPaceText = prefs.threshold_pace ? formatPace(prefs.threshold_pace) : "Not set";

  let prompt = buildTrainingRecommendationPrompt({
    athleteName: user.name,
    maxHr: prefs.max_hr ?? 190,
    restingHr: prefs.resting_hr ?? 50,
    thresholdPace: thresholdPaceText,
    ftp: ftpText,
    athleteProfile: user.profileSummary || "No profile summary available.",
    hrZones: hrZonesText,
    paceZones: paceZonesText,
    cyclingPowerZones: powerZonesText,
    recentActivities: activitiesText,
    weeklyDistance: weeklyDistance.toFixed(1),
    weeklyDuration: weeklyDuration.toFixed(1),
    weeklyAvgHr: weeklyAvgHr.toFixed(0),
    weeklyRuns,
    weeklyRides,
    weeklyOther,
    upcomingCompetitions: competitionsText,
    fixedPlan: fixedPlanText,
    weeklyTrimp: trimpLines.join("\n") || "No data.",
    recentRpe: rpeText,
    startDate,
    endDate,
    planningWeeks,
  });

  const allSports = ["running", "cycling", "swimming", "strength", "hiking", "rowing"];

  if (sportAvailability != null) {
    const selected = new Set(Object.keys(sportAvailability));
    const excluded = allSports.filter((s) => !selected.has(s));
    const lines: string[] = [];
    for (const [sport, cfg] of Object.entries(sportAvailability)) {
      const sportStart = cfg.start_date ?? startDate;
      if (sportStart <= startDate) {
        lines.push(`- ${sport}: available for the entire plan`);
      } else {
        lines.push(
          `- ${sport}: available from ${sportStart} onwards (do NOT schedule any ${sport} sessions before this date)`,
        );
      }
    }
    prompt += `\n\nIMPORTANT - Sport Availability Windows:\nThe athlete has specific availability dates for each sport. You MUST respect these windows:\n${lines.join("\n")}\nBefore a sport becomes available, use other available sports or rest days instead.`;
    if (excluded.length > 0) prompt += `\nDo NOT include sessions for: ${excluded.sort().join(", ")}.`;
  } else if (allowedSports != null) {
    const selected = new Set(allowedSports);
    if (selected.size > 0 && (selected.size !== allSports.length || ![...allSports].every((s) => selected.has(s)))) {
      if (selected.size === 1 && selected.has("running")) {
        prompt += `\n\nIMPORTANT: The athlete has requested a RUNNING-ONLY plan. Do NOT include cross-training sessions (cycling, swimming, strength, etc.). All sessions should have sport='running'. Use rest days instead of cross-training days.`;
      } else {
        const included = [...selected].sort().join(", ");
        const excluded = allSports.filter((s) => !selected.has(s)).sort().join(", ");
        prompt += `\n\nIMPORTANT: The athlete has selected specific sports for this plan. Only include sessions with sport set to one of: ${included}. Do NOT include sessions for: ${excluded}.`;
      }
    }
  }

  const result = await generateTrainingRecommendations(TRAINING_RECOMMENDATION_SYSTEM, prompt, onProgress);
  if (result.error) return { error: result.error };
  return result.data ?? {};
}

// ---------------------------------------------------------------------------
// convert_session
// ---------------------------------------------------------------------------

export async function convertSession(
  user: User,
  workout: Record<string, unknown>,
  targetType: string,
): Promise<Record<string, unknown>> {
  const prefs = (user.preferences ?? {}) as UserPreferences;
  const sourceType = targetType === "hr_based" ? "pace-based" : "HR-based";
  const prompt = buildPlanConversionPrompt({
    sourceType,
    targetType: targetType.replace(/_/g, " "),
    hrZones: formatHrZones(prefs.hr_zones),
    paceZones: formatPaceZones(prefs.pace_zones),
    sessionDetails: JSON.stringify(workout, null, 2),
    workoutType: typeof workout.type === "string" ? workout.type : "easy",
  });

  const result = await claudeConvert(PLAN_CONVERSION_SYSTEM, prompt);
  if (result.error) return { error: result.error };
  return result.data ?? {};
}

// ---------------------------------------------------------------------------
// save_recommendations
// ---------------------------------------------------------------------------

export async function saveRecommendations(
  user: User,
  recommendations: Record<string, unknown>,
): Promise<number> {
  const sessions = (recommendations.sessions ?? []) as unknown[];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = isoOf(today);

  let saved = 0;
  for (const raw of sessions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const sessionData = raw as Record<string, unknown>;
    const dateValue = sessionData.date;
    if (typeof dateValue !== "string") continue;
    if (dateValue < todayIso) continue;

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
        .set({ recommendationWorkout: sessionData, updatedAt: new Date() })
        .where(eq(trainingSessions.id, existing[0].id));
    } else {
      await db.insert(trainingSessions).values({
        userId: user.id,
        sessionDate: dateValue,
        source: "app_recommendation",
        recommendationWorkout: sessionData,
      });
      saved += 1;
    }
  }
  return saved;
}
