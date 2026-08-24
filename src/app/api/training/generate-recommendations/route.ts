import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { competitions } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { generateRecommendations, saveRecommendations } from "@/server/services/training-engine";
import { requireAiEnabled } from "@/server/services/ai-gate";
import { classifyEngineError, isUpstreamClaudeError } from "@/server/services/claude-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEEKS = 16;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A thrown error here is either ours (bad input, DB) or an upstream Anthropic
 * failure that reached us with its prefix intact. Only the latter gets
 * rewritten — our own messages are useful to the user.
 */
function safeGenerationMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (isUpstreamClaudeError(message)) return classifyEngineError(message).detail;
  return message || "Failed to generate recommendations";
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Before any credit is spent: the operator can switch the AI features off.
  const aiGate = await requireAiEnabled();
  if (aiGate) return aiGate.response;

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") ?? todayIso();
  const considerUploaded = sp.get("consider_uploaded_plan") !== "false";
  const sportsParam = sp.get("sports");
  const availabilityParam = sp.get("sport_availability");

  let endDate = sp.get("end_date");
  if (!endDate) {
    const maxEnd = addDaysIso(startDate, MAX_WEEKS * 7);
    const lastComp = await db
      .select()
      .from(competitions)
      .where(and(eq(competitions.userId, session.user.id), gte(competitions.raceDate, startDate)))
      .orderBy(desc(competitions.raceDate))
      .limit(1);
    if (lastComp[0] && (lastComp[0].raceDate as unknown as string) <= maxEnd) {
      endDate = addDaysIso(lastComp[0].raceDate as unknown as string, 3);
    } else {
      endDate = maxEnd;
    }
  }

  let sportAvailability: Record<string, { start_date?: string }> | null = null;
  let allowedSports: string[] | null = null;
  if (availabilityParam) {
    try {
      sportAvailability = JSON.parse(availabilityParam) as Record<string, { start_date?: string }>;
    } catch {
      sportAvailability = null;
    }
  } else if (sportsParam) {
    allowedSports = sportsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const generateInput = {
    user: session.user,
    startDate,
    endDate,
    considerFixedPlan: considerUploaded,
    allowedSports,
    sportAvailability,
  };

  // SSE mode: stream real progress events while the plan generates.
  if (sp.get("stream") === "true") {
    const encoder = new TextEncoder();
    const user = session.user;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // client disconnected — generation continues, nothing to notify
          }
        };
        send({ type: "status", stage: "preparing" });
        try {
          const result = await generateRecommendations(generateInput, (p) =>
            send({ type: "status", stage: p.stage, sessions: p.sessions }),
          );
          if (typeof result.error === "string") {
            // Log the upstream detail, send the safe classification. Without
            // this the athlete reads the operator's billing status.
            console.error("[generate-recommendations] claude error:", result.error);
            send({ type: "error", message: classifyEngineError(result.error).detail });
          } else {
            send({ type: "status", stage: "saving" });
            const saved = await saveRecommendations(user, result);
            send({ type: "done", saved, result });
          }
        } catch (err) {
          console.error("[generate-recommendations] error:", err);
          send({ type: "error", message: safeGenerationMessage(err) });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await generateRecommendations(generateInput);
    if (typeof result.error === "string") {
      console.error("[generate-recommendations] claude error:", result.error);
      const failure = classifyEngineError(result.error);
      return errorJson(failure.detail, failure.status);
    }
    await saveRecommendations(session.user, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[generate-recommendations] error:", err);
    return errorJson(safeGenerationMessage(err), 500);
  }
}

