import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { z } from "zod";
import { estimateZonesFromStrava, type EstimateAnchors } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional body: HR anchors sharpen the tier-1 sustained-effort detection
// (it gates on % of HR-reserve, which needs accurate max/resting HR).
const Body = z
  .object({
    max_hr: z.number().int().nullable().optional(),
    resting_hr: z.number().int().nullable().optional(),
  })
  .nullable();

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  const anchors: EstimateAnchors = parsed.success ? (parsed.data ?? {}) : {};

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;
  const result = await estimateZonesFromStrava(session.user, daysBack, anchors);
  if (!result.success) return errorJson(result.error ?? "Failed to estimate pace", 400);

  return NextResponse.json({
    threshold_pace: result.threshold_pace,
    threshold_pace_source: result.threshold_pace_source,
    pace_zones: result.pace_zones,
    activities_analyzed: result.activities_analyzed,
  });
}
