import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { requireAiEnabled } from "@/server/services/ai-gate";
import { classifyClaudeError, classifyResultError } from "@/server/services/claude-errors";
import { convertSession } from "@/server/services/training-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  workout: z.record(z.string(), z.unknown()),
  target_type: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Before any credit is spent: the operator can switch the AI features off.
  const aiGate = await requireAiEnabled();
  if (aiGate) return aiGate.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  try {
    const result = await convertSession(session.user, parsed.data.workout, parsed.data.target_type);
    if (typeof result.error === "string") {
      // The engine returns the upstream text verbatim; log it, answer with the
      // safe classification. Same reasoning as the chat route: "your credit
      // balance is too low" is for the operator, not for the athlete. The
      // engine's own diagnostics are classified separately, not laundered into
      // the generic message.
      console.error("[convert-session] claude error:", result.error);
      const failure = classifyResultError(result.error);
      return errorJson(failure.detail, failure.status);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[convert-session] error:", err);
    const failure = classifyClaudeError(err);
    return errorJson(failure.detail, failure.status);
  }
}
