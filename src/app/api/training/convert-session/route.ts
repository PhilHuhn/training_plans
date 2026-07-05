import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
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

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  try {
    const result = await convertSession(session.user, parsed.data.workout, parsed.data.target_type);
    if (typeof result.error === "string") return errorJson(result.error, 500);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[convert-session] error:", err);
    return errorJson(err instanceof Error ? err.message : "Failed to convert session", 500);
  }
}
