import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, users, type User, type UserPreferences } from "@/server/db/schema";
import { env } from "@/server/env";
import { generateText } from "@/server/services/claude";
import { aiAvailability } from "@/server/services/app-settings";

export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_API_URL = "https://www.strava.com/api/v3";

export const STRAVA_REDIRECT_URI = `${env.BASE_URL}/api/strava/callback`;

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export class StravaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function refreshStravaToken(user: User): Promise<string> {
  if (!user.stravaRefreshToken) {
    throw new StravaError("Strava not connected", 400);
  }

  const now = new Date();
  if (
    user.stravaTokenExpiresAt &&
    user.stravaTokenExpiresAt > now &&
    user.stravaAccessToken
  ) {
    return user.stravaAccessToken;
  }

  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    refresh_token: user.stravaRefreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new StravaError("Failed to refresh Strava token", 400);
  }
  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  await db
    .update(users)
    .set({
      stravaAccessToken: tokens.access_token,
      stravaRefreshToken: tokens.refresh_token,
      stravaTokenExpiresAt: new Date(tokens.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Activity sync
// ---------------------------------------------------------------------------

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  total_elevation_gain?: number | null;
  calories?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  start_date: string;
  start_date_local?: string | null;
  workout_type?: number | null;
  commute?: boolean | null;
}

interface StravaLap {
  name?: string | null;
  distance?: number | null;
  elapsed_time?: number | null;
  moving_time?: number | null;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  lap_index?: number | null;
  split?: number | null;
  pace_zone?: number | null;
}

export async function syncStravaActivities(
  user: User,
  accessToken: string,
  daysBack = 30,
): Promise<number> {
  const afterTimestamp = Math.floor(
    (Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000,
  );

  let synced = 0;
  let page = 1;
  const perPage = 50;
  const newRunStravaIds: string[] = [];

  while (page <= 10) {
    const url = new URL(`${STRAVA_API_URL}/athlete/activities`);
    url.searchParams.set("after", String(afterTimestamp));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) break;

    const list = (await response.json()) as StravaActivity[];
    if (!list.length) break;

    for (const a of list) {
      const stravaId = String(a.id);

      const existing = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.stravaId, stravaId))
        .limit(1);
      if (existing.length > 0) continue;

      const distance = a.distance ?? 0;
      const movingTime = a.moving_time ?? 0;
      let avgPace: number | null = null;
      if (distance > 0 && RUN_TYPES.includes(a.type)) {
        avgPace = (movingTime / distance) * 1000;
      }

      const startDate = new Date(a.start_date);
      const startDateLocal = a.start_date_local ? new Date(a.start_date_local) : null;

      await db.insert(activities).values({
        userId: user.id,
        stravaId,
        name: a.name ?? "Untitled Activity",
        activityType: a.type,
        description: a.description ?? null,
        distance: distance || null,
        duration: movingTime || null,
        elevationGain: a.total_elevation_gain ?? null,
        calories: a.calories ?? null,
        avgHeartRate: a.average_heartrate ?? null,
        maxHeartRate: a.max_heartrate ?? null,
        avgPace,
        startDate,
        startDateLocal,
        rawData: a as unknown,
        workoutType: a.workout_type ?? null,
        isCommute: a.commute ? 1 : 0,
      });
      synced += 1;

      if (RUN_TYPES.includes(a.type)) {
        newRunStravaIds.push(stravaId);
      }
    }

    page += 1;
  }

  // Fetch lap data for new running activities (best-effort, non-fatal).
  for (const stravaId of newRunStravaIds) {
    try {
      const laps = await fetchActivityLaps(accessToken, stravaId);
      if (laps.length > 0) {
        await db
          .update(activities)
          .set({ lapsData: laps as unknown })
          .where(eq(activities.stravaId, stravaId));
      }
    } catch (err) {
      console.warn(`[strava] failed to fetch laps for ${stravaId}:`, err);
    }
  }

  return synced;
}

async function fetchActivityLaps(
  accessToken: string,
  stravaActivityId: string,
): Promise<StravaLap[]> {
  const response = await fetch(`${STRAVA_API_URL}/activities/${stravaActivityId}/laps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  const laps = (await response.json()) as StravaLap[];
  return laps.map((l) => ({
    name: l.name ?? null,
    distance: l.distance ?? null,
    elapsed_time: l.elapsed_time ?? null,
    moving_time: l.moving_time ?? null,
    average_speed: l.average_speed ?? null,
    max_speed: l.max_speed ?? null,
    average_heartrate: l.average_heartrate ?? null,
    max_heartrate: l.max_heartrate ?? null,
    lap_index: l.lap_index ?? null,
    split: l.split ?? null,
    pace_zone: l.pace_zone ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Lap-based workout type detection
// ---------------------------------------------------------------------------

export function analyzeLapsForWorkoutType(lapsData: unknown): string | null {
  const laps = (lapsData ?? []) as StravaLap[];
  if (!Array.isArray(laps) || laps.length < 2) return null;

  const paces: number[] = [];
  for (const lap of laps) {
    if (lap.moving_time && lap.distance && lap.distance > 0) {
      paces.push((lap.moving_time / lap.distance) * 1000);
    }
  }
  if (paces.length < 2) return null;

  const avgPace = paces.reduce((s, p) => s + p, 0) / paces.length;
  const variance = paces.reduce((s, p) => s + (p - avgPace) ** 2, 0) / paces.length;
  const std = Math.sqrt(variance);

  const fast = paces.filter((p) => p < avgPace - 15).length;
  const slow = paces.filter((p) => p > avgPace + 15).length;

  if (fast >= 3 && slow >= 2 && std > 20) return "intervals";
  if (std < 10 && paces.length > 3 && avgPace < 300) return "tempo";
  return null;
}

// ---------------------------------------------------------------------------
// Profile summary (Claude-driven, with deterministic fallback)
// ---------------------------------------------------------------------------

function formatPaceSec(sec: number | null | undefined): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fallbackProfileLine(args: {
  fitness: string;
  weeklyDistance: number;
  weeklyRuns: number;
  avgPaceSec: number | null | undefined;
  longestKm: number;
}): string {
  return (
    `${args.fitness.charAt(0).toUpperCase() + args.fitness.slice(1)} runner averaging ` +
    `${args.weeklyDistance.toFixed(1)} km/week over ${args.weeklyRuns.toFixed(1)} runs. ` +
    `Average pace: ${formatPaceSec(args.avgPaceSec)}/km. ` +
    `Longest recent run: ${args.longestKm.toFixed(1)} km.`
  );
}

export async function generateUserProfileSummary(user: User): Promise<string> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Aggregate running stats
  const [stats] = await db
    .select({
      totalRuns: sql<number>`count(*)::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)::float`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)::float`,
      avgPace: sql<number>`avg(${activities.avgPace})::float`,
      avgHr: sql<number>`avg(${activities.avgHeartRate})::float`,
      longestRun: sql<number>`coalesce(max(${activities.distance}), 0)::float`,
      avgElevation: sql<number>`avg(${activities.elevationGain})::float`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, user.id),
        gte(activities.startDate, cutoff),
        sql`${activities.activityType} IN ('Run','TrailRun','VirtualRun')`,
      ),
    );

  if (!stats || !stats.totalRuns) {
    return "New runner with no recent activity data. Recommend starting with a beginner-friendly plan.";
  }

  // Activity-type counts (cross-training)
  const typeCountsRows = await db
    .select({ type: activities.activityType, count: sql<number>`count(*)::int` })
    .from(activities)
    .where(and(eq(activities.userId, user.id), gte(activities.startDate, cutoff)))
    .groupBy(activities.activityType);
  const crossTraining: Record<string, number> = {};
  for (const r of typeCountsRows) {
    if (!RUN_TYPES.includes(r.type)) crossTraining[r.type] = r.count;
  }

  const weeks = 13;
  const weeklyDistance = stats.totalDistance / 1000 / weeks;
  const weeklyRuns = stats.totalRuns / weeks;
  const weeklyTimeMin = stats.totalDuration / 60 / weeks;
  const longestKm = (stats.longestRun ?? 0) / 1000;
  const avgPaceFmt = formatPaceSec(stats.avgPace);

  let fitness = "intermediate";
  if (weeklyDistance < 20) fitness = "beginner";
  else if (weeklyDistance > 50) fitness = "advanced";

  // Workout variety detection — names + lap pattern
  const recent = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.userId, user.id),
        gte(activities.startDate, cutoff),
        sql`${activities.activityType} IN ('Run','TrailRun','VirtualRun')`,
      ),
    )
    .orderBy(desc(activities.startDate))
    .limit(30);

  const variety: Record<string, number> = {};
  const bump = (k: string) => {
    variety[k] = (variety[k] ?? 0) + 1;
  };
  for (const a of recent) {
    let detected: string | null = null;
    if (a.workoutType === 1) detected = "races";
    else if (a.workoutType === 2) detected = "long_runs";
    else if (a.workoutType === 3) detected = "intervals";
    if (!detected && a.lapsData) detected = analyzeLapsForWorkoutType(a.lapsData);
    if (!detected) {
      const n = (a.name ?? "").toLowerCase();
      if (/(tempo|threshold|t-run)/.test(n)) detected = "tempo";
      else if (/(interval|speed|track|fartlek|rep|400|800|1k|1000)/.test(n)) detected = "intervals";
      else if (/(long|lsd)/.test(n)) detected = "long_runs";
      else if (/(recovery|easy|shake)/.test(n)) detected = "easy";
      else if (/(race|parkrun|5k|10k|marathon|half)/.test(n)) detected = "races";
    }
    if (!detected && a.distance) {
      detected = a.distance / 1000 > 18 ? "long_runs" : "other";
    }
    if (detected) bump(detected);
  }

  const prefs = (user.preferences ?? {}) as UserPreferences;
  const prompt =
    `Based on the following activity data for ${user.name}, generate a concise athlete profile summary (3-5 sentences).\n\n` +
    `RUNNING Statistics (Last 90 Days):\n` +
    `- Total runs: ${stats.totalRuns}\n` +
    `- Total distance: ${(stats.totalDistance / 1000).toFixed(1)} km\n` +
    `- Total time: ${(stats.totalDuration / 3600).toFixed(1)} hours\n` +
    `- Average pace: ${avgPaceFmt} /km\n` +
    `- Average heart rate: ${stats.avgHr ? Math.round(stats.avgHr) : "N/A"} bpm\n` +
    `- Longest single run: ${longestKm.toFixed(1)} km\n` +
    `- Average elevation gain per run: ${stats.avgElevation ? Math.round(stats.avgElevation) : 0} m\n` +
    `- Weekly averages: ${weeklyDistance.toFixed(1)} km, ${weeklyRuns.toFixed(1)} runs, ${Math.round(weeklyTimeMin)} min\n\n` +
    `Detected Workout Types: ${JSON.stringify(variety)}\n` +
    `Cross-Training Activities: ${JSON.stringify(crossTraining)}\n` +
    `Max HR: ${prefs.max_hr ?? "Not set"}, Resting HR: ${prefs.resting_hr ?? "Not set"}\n\n` +
    `Summarize this runner's:\n` +
    `1. Current fitness level (beginner/intermediate/advanced)\n` +
    `2. Training volume and consistency\n` +
    `3. Workout variety - note the detected workout types from lap analysis\n` +
    `4. Cross-training habits if any\n` +
    `5. Any notable strengths or areas for improvement\n\n` +
    `Keep it concise and actionable for training recommendations. Do NOT use any markdown formatting like **bold** or *italic*. Write plain text only. Do NOT include any pleasantries or preamble - just the profile summary.`;

  // Syncing must keep working when AI is off, so this degrades rather than
  // failing: the deterministic fallback below is always a valid summary. The
  // check is what stops a sync from silently spending credit.
  if ((await aiAvailability()).available) {
    try {
      const text = await generateText(prompt, 400);
      if (text.trim()) return text.trim();
    } catch (err) {
      console.warn("[strava] Claude profile-summary failed; using fallback:", err);
    }
  }

  return fallbackProfileLine({
    fitness,
    weeklyDistance,
    weeklyRuns,
    avgPaceSec: stats.avgPace,
    longestKm,
  });
}

export async function updateUserProfileAfterSync(user: User): Promise<void> {
  const summary = await generateUserProfileSummary(user);
  await db.update(users).set({ profileSummary: summary, updatedAt: new Date() }).where(eq(users.id, user.id));
}

// Re-export for routes
export type { UserPreferences };
