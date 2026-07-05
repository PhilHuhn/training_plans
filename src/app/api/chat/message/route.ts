import { type NextRequest } from "next/server";
import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  activities,
  competitions,
  trainingSessions,
  type User,
  type UserPreferences,
} from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { anthropic, CLAUDE_MODEL } from "@/server/services/claude";
import { formatPace } from "@/server/services/pace";

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

const SYSTEM_PROMPT_TEMPLATE = `You are Turbi, the AI coach for the Turbine Turmweg Training app.
You help users with their training plans, provide feedback on workouts, and can modify their training schedule.

You have access to tools to:
- View training sessions and activities
- Modify existing workouts
- Create new training sessions
- View upcoming competitions
- View user's HR and pace zones

When modifying workouts, always explain what you're changing and why.
Be encouraging but realistic about training goals.
Consider the user's recent training load when making suggestions.
Use the user's configured zones when relevant.

Today's date is {today}.{profileSection}
`;

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
    description: "Get recent completed activities from Strava. Use this to understand the user's recent training load.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Number of days to look back (default 14)" },
      },
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
        return `- ${a.startDate.toISOString().slice(0, 10)}: ${a.name}, ${km} km${pace}`;
      });
      lines.push(`\nTotal: ${Math.round(totalKm * 10) / 10} km in ${days} days`);
      return lines.join("\n");
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
    max_tokens: 2048,
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
      max_tokens: 2048,
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

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  const profileSection = session.user.profileSummary
    ? `\n\nUser Profile:\n${session.user.profileSummary}`
    : "";
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{today}", todayIso()).replace(
    "{profileSection}",
    profileSection,
  );

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
          const message = err instanceof Error ? err.message : "Chat failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message, done: true })}\n\n`),
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
    return errorJson(err instanceof Error ? err.message : "Chat failed", 500);
  }
}
