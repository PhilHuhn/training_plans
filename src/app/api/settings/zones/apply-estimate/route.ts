import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import {
  applyZonesToUser,
  estimateZonesFromStrava,
  saveZonesToHistory,
} from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;
  const result = await estimateZonesFromStrava(session.user, daysBack);
  if (!result.success) return errorJson(result.error ?? "Failed to estimate zones", 400);

  await applyZonesToUser(session.user, {
    hr_zones: result.hr_zones!,
    pace_zones: result.pace_zones!,
    max_hr: result.max_hr,
    resting_hr: result.resting_hr,
    threshold_hr: result.threshold_hr,
    threshold_pace: result.threshold_pace,
    threshold_hr_source: result.threshold_hr_source,
    threshold_pace_source: result.threshold_pace_source,
  });

  await saveZonesToHistory(
    session.user,
    {
      activities_analyzed: result.activities_analyzed,
      date_range_start: result.date_range_start ?? null,
      date_range_end: result.date_range_end ?? null,
      max_hr: result.max_hr ?? null,
      resting_hr: result.resting_hr ?? null,
      threshold_hr: result.threshold_hr ?? null,
      threshold_pace: result.threshold_pace ?? null,
      hr_zones: result.hr_zones ?? null,
      pace_zones: result.pace_zones ?? null,
      avg_hr_easy_runs: result.avg_hr_easy_runs ?? null,
      avg_hr_tempo_runs: result.avg_hr_tempo_runs ?? null,
      avg_pace_easy_runs: result.avg_pace_easy_runs ?? null,
      avg_pace_tempo_runs: result.avg_pace_tempo_runs ?? null,
    },
    "strava_estimate",
  );

  return NextResponse.json({
    message: "Zones applied successfully",
    activities_analyzed: result.activities_analyzed,
    threshold_hr: result.threshold_hr,
    threshold_hr_source: result.threshold_hr_source,
    threshold_pace: result.threshold_pace,
    threshold_pace_source: result.threshold_pace_source,
    hr_zones: result.hr_zones,
    pace_zones: result.pace_zones,
  });
}
