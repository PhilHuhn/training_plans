import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { getZoneHistoryForUser } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10;
  const rows = await getZoneHistoryForUser(session.user, limit);

  return NextResponse.json(
    rows.map((h) => ({
      id: h.id,
      calculated_at: h.calculatedAt ? h.calculatedAt.toISOString() : null,
      source: h.source,
      activities_analyzed: h.activitiesAnalyzed,
      max_hr: h.maxHr,
      resting_hr: h.restingHr,
      threshold_pace: h.thresholdPace,
      hr_zones: h.hrZones,
      pace_zones: h.paceZones,
      ftp: h.ftp,
      cycling_power_zones: h.cyclingPowerZones,
    })),
  );
}
