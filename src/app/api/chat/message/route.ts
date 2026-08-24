import { type NextRequest } from "next/server";
import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  competitions,
  trainingSessions,
  users,
  type User,
  type UserPreferences,
} from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { anthropic, CLAUDE_MODEL } from "@/server/services/claude";
import { classifyClaudeError } from "@/server/services/claude-errors";
import { requireAiEnabled } from "@/server/services/ai-gate";
import { formatPace } from "@/server/services/pace";
import { buildCoachSystemPrompt } from "@/server/prompts/coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  stream: z.boolean().optional().default(true),
});

const TOOLS: Tool[] = [
  {
    name: "get_training_sessions",
    description: "Get training sessions for a date range. Use this to see what workouts are planned.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
        end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_session_details",
    description: "Get detailed information about a specific training session by ID.",
    input_schema: {
      type: "object",
      properties: { session_id: { type: "integer", description: "The session ID" } },
      required: ["session_id"],
    },
  },
  {
    name: "update_session_workout",
    description:
      "Update a training session's workout. By default writes to AI recommendation column. Set write_to_manual=true only if user explicitly asks to write to their manual/planned column.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "integer", description: "The session ID to update" },
        workout_type: {
          type: "string",
          enum: ["easy", "tempo", "interval", "long_run", "recovery", "cross_training", "rest"],
          description: "Type of workout",
        },
        description: { type: "string", description: "Workout description" },
        distance_km: { type: "number", description: "Distance in kilometers" },
        duration_min: { type: "integer", description: "Duration in minutes" },
        intensity: { type: "string", enum: ["low", "moderate", "high"], description: "Workout intensity" },
        pace_range: { type: "string", description: "Pace range like '5:00-5:30'" },
        hr_zone: { type: "string", description: "Heart rate zone like 'zone2'" },
        write_to_manual: {
          type: "boolean",
          description:
            "If true, write to manual/planned column instead of AI recommendation. Only set true if user explicitly requests it.",
        },
      },
      required: ["session_id", "workout_type", "description"],
    },
  },
  {
    name: "create_session",
    description:
      "Create a new training session for a specific date. By default writes to AI recommendation column. Set write_to_manual=true only if user explicitly asks to write to their manual/planned column.",
    input_schema: {
      type: "object",
      properties: {
        session_date: { type: "string", description: "Date in YYYY-MM-DD format" },
        workout_type: {
          type: "string",
          enum: ["easy", "tempo", "interval", "long_run", "recovery", "cross_training", "rest"],
          description: "Type of workout",
        },
        description: { type: "string", description: "Workout description" },
        distance_km: { type: "number", description: "Distance in kilometers" },
        duration_min: { type: "integer", description: "Duration in minutes" },
        intensity: { type: "string", enum: ["low", "moderate", "high"], description: "Workout intensity" },
        pace_range: { type: "string", description: "Pace range like '5:00-5:30'" },
        write_to_manual: {
          type: "boolean",
          description:
            "If true, write to manual/planned column instead of AI recommendation. Only set true if user explicitly requests it.",
        },
      },
      required: ["session_date", "workout_type", "description"],
    },
  },
  {
    name: "get_recent_activities",
    description: "Get recent completed activities from Strava. Use this to understand the user's recent training load. Each line includes the activity ID for drill-down via get_activity_laps.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Number of days to look back (default 14)" },
      },
    },
  },
  {
    name: "get_activity_laps",
    description:
      "Get per-lap splits (distance, time, pace, HR) for a completed activity. Use the ID from get_recent_activities. Essential for reviewing interval, threshold, and race sessions in detail.",
    input_schema: {
      type: "object",
      properties: {
        activity_id: { type: "integer", description: "Activity ID from get_recent_activities" },
      },
      required: ["activity_id"],
    },
  },
  {
    name: "update_athlete_profile",
    description:
      "Replace the athlete profile living document. Use when durable new information emerges (injuries, PRs, race results, learnings, schedule constraints). Rewrite the FULL document with your changes merged in — never submit a fragment. Propose profile updates to the athlete before calling, unless they explicitly asked you to note something.",
    input_schema: {
      type: "object",
      properties: {
        profile: {
          type: "string",
          description: "Complete new markdown content of the athlete profile",
        },
        change_summary: {
          type: "string",
          description: "1-2 line summary of what changed",
        },
      },
      required: ["profile", "change_summary"],
    },
  },
  {
    name: "get_upcoming_competitions",
    description: "Get the user's upcoming races/competitions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_user_zones",
    description: "Get the user's heart rate and pace zones.",
    input_schema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface WorkoutForChat {
  type?: string;
  description?: string;
  distance_km?: number | null;
  duration_min?: number | null;
  intensity?: string;
  pace_range?: string;
  hr_zone?: string;
}

async function executeTool(
  user: User,
  toolName: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (toolName) {
    case "get_training_sessions": {
      const start = String(input.start_date ?? "");
      const end = String(input.end_date ?? "");
      const rows = await db
        .select()
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.userId, user.id),
            gte(trainingSessions.sessionDate, start),
            lte(trainingSessions.sessionDate, end),
          ),
        )
        .orderBy(asc(trainingSessions.sessionDate));
      if (rows.length === 0) return `No training sessions found between ${start} and ${end}.`;
      return rows
        .map((s) => {
          const w = (s.finalWorkout ?? s.plannedWorkout ?? s.recommendationWorkout ?? {}) as WorkoutForChat;
          if (!w.type && !w.description) return `- ${s.sessionDate}: ID=${s.id}, No workout defined`;
          return `- ${s.sessionDate}: ID=${s.id}, ${w.type ?? "unknown"} - ${w.description ?? "No description"}, ${w.distance_km ?? "N/A"} km`;
        })
        .join("\n");
    }
    case "get_session_details": {
      const id = Number(input.session_id);
      const [session] = await db
        .select()
        .from(trainingSessions)
        .where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, user.id)))
        .limit(1);
      if (!session) return "Session not found.";
      return JSON.stringify(
        {
          id: session.id,
          date: session.sessionDate,
          planned_workout: session.plannedWorkout,
          recommendation_workout: session.recommendationWorkout,
          final_workout: session.finalWorkout,
          status: session.status,
          accepted_source: session.acceptedSource,
        },
        null,
        2,
      );
    }
    case "update_session_workout": {
      const id = Number(input.session_id);
      const [session] = await db
        .select()
        .from(trainingSessions)
        .where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, user.id)))
        .limit(1);
      if (!session) return "Session not found.";

      const workout: WorkoutForChat = {
        type: String(input.workout_type),
        description: String(input.description),
        distance_km: typeof input.distance_km === "number" ? input.distance_km : null,
        duration_min: typeof input.duration_min === "number" ? input.duration_min : null,
        intensity: typeof input.intensity === "string" ? input.intensity : undefined,
        pace_range: typeof input.pace_range === "string" ? input.pace_range : undefined,
        hr_zone: typeof input.hr_zone === "string" ? input.hr_zone : undefined,
      };

      const writeManual = input.write_to_manual === true;
      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (writeManual) update.plannedWorkout = workout;
      else update.recommendationWorkout = workout;

      await db.update(trainingSessions).set(update).where(eq(trainingSessions.id, session.id));
      const column = writeManual ? "manual/planned" : "AI recommendation";
      return `Updated session ${session.id} on ${session.sessionDate} (${column} column) with new workout: ${workout.description}`;
    }
    case "create_session": {
      const dateValue = String(input.session_date ?? "");
      const writeManual = input.write_to_manual === true;
      const workout: WorkoutForChat = {
        type: String(input.workout_type),
        description: String(input.description),
        distance_km: typeof input.distance_km === "number" ? input.distance_km : null,
        duration_min: typeof input.duration_min === "number" ? input.duration_min : null,
        intensity: typeof input.intensity === "string" ? input.intensity : undefined,
        pace_range: typeof input.pace_range === "string" ? input.pace_range : undefined,
      };

      const [existing] = await db
        .select()
        .from(trainingSessions)
        .where(
          and(eq(trainingSessions.userId, user.id), eq(trainingSessions.sessionDate, dateValue)),
        )
        .limit(1);

      const column = writeManual ? "manual/planned" : "AI recommendation";
      if (existing) {
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (writeManual) update.plannedWorkout = workout;
        else update.recommendationWorkout = workout;
        await db.update(trainingSessions).set(update).where(eq(trainingSessions.id, existing.id));
        return `Updated existing session on ${dateValue} (ID=${existing.id}, ${column} column): ${workout.description}`;
      }

      const [created] = await db
        .insert(trainingSessions)
        .values({
          userId: user.id,
          sessionDate: dateValue,
          source: writeManual ? "manual" : "app_recommendation",
          plannedWorkout: writeManual ? workout : null,
          recommendationWorkout: writeManual ? null : workout,
        })
        .returning();
      return `Created new session on ${dateValue} (ID=${created.id}, ${column} column): ${workout.description}`;
    }
    case "get_recent_activities": {
      const days = typeof input.days === "number" ? input.days : 14;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await db
        .select()
        .from(activities)
        .where(and(eq(activities.userId, user.id), gte(activities.startDate, cutoff)))
        .orderBy(desc(activities.startDate));
      if (rows.length === 0) return `No activities found in the last ${days} days.`;
      let totalKm = 0;
      const lines = rows.map((a) => {
        const km = Math.round(((a.distance ?? 0) / 1000) * 10) / 10;
        totalKm += km;
        const pace = a.avgPace ? `, ${formatPace(a.avgPace)}/km` : "";
        const hr = a.avgHeartRate ? `, avg HR ${Math.round(a.avgHeartRate)}` : "";
        const laps = Array.isArray(a.lapsData) && a.lapsData.length > 1 ? ", laps available" : "";
        return `- ${a.startDate.toISOString().slice(0, 10)}: ID=${a.id}, ${a.name}, ${km} km${pace}${hr}${laps}`;
      });
      lines.push(`\nTotal: ${Math.round(totalKm * 10) / 10} km in ${days} days`);
      return lines.join("\n");
    }
    case "get_activity_laps": {
      const id = Number(input.activity_id);
      const [activity] = await db
        .select()
        .from(activities)
        .where(and(eq(activities.id, id), eq(activities.userId, user.id)))
        .limit(1);
      if (!activity) return "Activity not found.";

      const km = Math.round(((activity.distance ?? 0) / 1000) * 10) / 10;
      const header = `${activity.name} — ${activity.startDate.toISOString().slice(0, 10)}, ${km} km${activity.avgPace ? `, ${formatPace(activity.avgPace)}/km avg` : ""}${activity.avgHeartRate ? `, avg HR ${Math.round(activity.avgHeartRate)}` : ""}`;

      const laps = activity.lapsData as
        | Array<{
            name?: string | null;
            distance?: number | null;
            moving_time?: number | null;
            average_heartrate?: number | null;
            max_heartrate?: number | null;
            lap_index?: number | null;
          }>
        | null;
      if (!Array.isArray(laps) || laps.length === 0) {
        return `${header}\n\nNo lap data recorded for this activity.`;
      }

      const lapLines = laps.map((lap, i) => {
        const idx = lap.lap_index ?? i + 1;
        const distKm = lap.distance ? Math.round((lap.distance / 1000) * 100) / 100 : null;
        const pace =
          lap.distance && lap.moving_time && lap.distance > 0
            ? formatPace((lap.moving_time / lap.distance) * 1000)
            : null;
        const parts: string[] = [];
        if (distKm != null) parts.push(`${distKm.toFixed(2)} km`);
        if (pace) parts.push(`${pace}/km`);
        if (lap.moving_time) {
          const m = Math.floor(lap.moving_time / 60);
          const s = Math.round(lap.moving_time % 60);
          parts.push(`${m}:${String(s).padStart(2, "0")}`);
        }
        if (lap.average_heartrate) parts.push(`avg HR ${Math.round(lap.average_heartrate)}`);
        if (lap.max_heartrate) parts.push(`max ${Math.round(lap.max_heartrate)}`);
        const name = lap.name && !/^lap \d+$/i.test(lap.name) ? ` (${lap.name})` : "";
        return `Lap ${idx}: ${parts.join(", ")}${name}`;
      });
      return `${header}\n\n${lapLines.join("\n")}`;
    }
    case "update_athlete_profile": {
      const profile = typeof input.profile === "string" ? input.profile.trim() : "";
      const changeSummary =
        typeof input.change_summary === "string" ? input.change_summary : "no summary provided";

      // Guardrails: the tool must always receive the complete document, never
      // a fragment, and the document must stay within sane bounds.
      if (profile.length < 200) {
        return "Rejected: profile too short (<200 chars). Submit the COMPLETE athlete profile document with your changes merged in, not a fragment.";
      }
      if (profile.length > 20_000) {
        return "Rejected: profile too long (>20,000 chars). Condense the document — merge or drop outdated entries.";
      }
      const currentLength = user.athleteProfile?.trim().length ?? 0;
      if (currentLength > 0 && profile.length < currentLength * 0.4) {
        return `Rejected: submitted profile (${profile.length} chars) is much shorter than the current one (${currentLength} chars) — this looks like accidental truncation. Resubmit the full document with your changes merged in.`;
      }

      await db
        .update(users)
        .set({ athleteProfile: profile, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      return `Athlete profile updated: ${changeSummary}`;
    }
    case "get_upcoming_competitions": {
      const today = todayIso();
      const rows = await db
        .select()
        .from(competitions)
        .where(and(eq(competitions.userId, user.id), gte(competitions.raceDate, today)))
        .orderBy(asc(competitions.raceDate));
      if (rows.length === 0) return "No upcoming competitions.";
      return rows
        .map((c) => {
          const days = Math.round(
            (new Date(`${c.raceDate as unknown as string}T00:00:00Z`).getTime() -
              new Date(`${today}T00:00:00Z`).getTime()) /
              (24 * 60 * 60 * 1000),
          );
          return `- ${c.raceDate}: ${c.name} (${c.raceType}), Goal: ${c.goalTime ?? "Not set"}, Priority: ${c.priority ?? "N/A"}, ${days} days away`;
        })
        .join("\n");
    }
    case "get_user_zones": {
      const prefs = (user.preferences ?? {}) as UserPreferences;
      const lines: string[] = [];
      if (prefs.max_hr) lines.push(`Max HR: ${prefs.max_hr} bpm`);
      if (prefs.resting_hr) lines.push(`Resting HR: ${prefs.resting_hr} bpm`);
      if (prefs.threshold_pace) lines.push(`Threshold Pace: ${formatPace(prefs.threshold_pace)}/km`);
      if (prefs.hr_zones && Object.keys(prefs.hr_zones).length > 0) {
        lines.push("\nHR Zones:");
        for (const [zone, v] of Object.entries(prefs.hr_zones)) {
          lines.push(`  ${zone}: ${v.min ?? "N/A"}-${v.max ?? "N/A"} bpm`);
        }
      }
      if (prefs.pace_zones && Object.keys(prefs.pace_zones).length > 0) {
        lines.push("\nPace Zones:");
        for (const [zone, v] of Object.entries(prefs.pace_zones)) {
          lines.push(`  ${zone}: ${formatPace(v.min)}-${formatPace(v.max)}/km`);
        }
      }
      return lines.length === 0 ? "No zones configured." : lines.join("\n");
    }
  }
  return `Unknown tool: ${toolName}`;
}

// ---------------------------------------------------------------------------
// Tool-use loop driver
// ---------------------------------------------------------------------------

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: "text";
  text: string;
}

type ContentBlock = ToolUseBlock | TextBlock;

async function runToolLoop(
  user: User,
  systemPrompt: string,
  initialMessages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ text: string; toolResults: Array<{ tool: string; input: Record<string, unknown>; result: string }> }> {
  const client = anthropic();
  const messages: MessageParam[] = initialMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolResults: Array<{ tool: string; input: Record<string, unknown>; result: string }> = [];

  let response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  while (response.stop_reason === "tool_use") {
    const toolUses = (response.content as ContentBlock[]).filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    const results: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
    for (const tu of toolUses) {
      const result = await executeTool(user, tu.name, tu.input);
      toolResults.push({ tool: tu.name, input: tu.input, result });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });

    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
  }

  let text = "";
  for (const block of response.content as ContentBlock[]) {
    if (block.type === "text") text += block.text;
  }
  return { text, toolResults };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Before any credit is spent: the operator can switch the AI features off.
  const aiGate = await requireAiEnabled();
  if (aiGate) return aiGate.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  const systemPrompt = buildCoachSystemPrompt(session.user, todayIso());

  if (parsed.data.stream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const { text } = await runToolLoop(session.user, systemPrompt, parsed.data.messages);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: text, done: true })}\n\n`),
          );
          controller.close();
        } catch (err) {
          // Log the upstream detail here: the client only ever sees the safe
          // message, so without this line an outage leaves no trace at all.
          console.error("[chat] tool loop failed (stream):", err);
          const failure = classifyClaudeError(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: failure.detail,
                retryable: failure.retryable,
                done: true,
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const { text, toolResults } = await runToolLoop(session.user, systemPrompt, parsed.data.messages);
    return Response.json({
      message: { role: "assistant", content: text },
      tool_results: toolResults.length > 0 ? toolResults : undefined,
    });
  } catch (err) {
    console.error("[chat] tool loop failed:", err);
    const failure = classifyClaudeError(err);
    return errorJson(failure.detail, failure.status, {
      headers: { "X-Retryable": String(failure.retryable) },
    });
  }
}
