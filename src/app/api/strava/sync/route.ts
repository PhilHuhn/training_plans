import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import {
  refreshStravaToken,
  StravaError,
  syncStravaActivities,
  updateUserProfileAfterSync,
} from "@/server/services/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  if (!session.user.stravaAccessToken) {
    return errorJson("Strava not connected", 400);
  }

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;

  try {
    const accessToken = await refreshStravaToken(session.user);
    const synced = await syncStravaActivities(session.user, accessToken, daysBack);
    try {
      await updateUserProfileAfterSync(session.user);
    } catch (err) {
      console.warn("[strava/sync] failed to update profile summary:", err);
    }
    return NextResponse.json({
      message: `Synced ${synced} activities from Strava`,
      count: synced,
    });
  } catch (err) {
    if (err instanceof StravaError) return errorJson(err.message, err.status);
    console.error("[strava/sync] error:", err);
    return errorJson("Failed to sync Strava activities", 500);
  }
}
