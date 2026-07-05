import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { estimateZonesFromStrava, validateHrAnchors, type EstimateAnchors } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional body: anchor values the user wants pinned instead of data-derived.
const Body = z
  .object({
    max_hr: z.number().int().nullable().optional(),
    resting_hr: z.number().int().nullable().optional(),
    threshold_hr: z.number().int().nullable().optional(),
  })
  .nullable();

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return errorJson("Invalid anchor values", 400);
  const anchors: EstimateAnchors = parsed.data ?? {};

  const anchorCheck = validateHrAnchors(anchors);
  if (!anchorCheck.ok) return errorJson(anchorCheck.errors.join("; "), 400);

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;
  const result = await estimateZonesFromStrava(session.user, daysBack, anchors);
  if (!result.success) return errorJson(result.error ?? "Failed to estimate HR", 400);

  return NextResponse.json({
    max_hr: result.max_hr,
    resting_hr: result.resting_hr,
    threshold_hr: result.threshold_hr,
    threshold_hr_source: result.threshold_hr_source,
    hr_zones: result.hr_zones,
    activities_analyzed: result.activities_analyzed,
  });
}
