import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/server/auth/admin";
import { aiAvailability } from "@/server/services/app-settings";
import { requireSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;
  const u = session.user;
  // Global, not per-user, but this payload is already every client's source of
  // truth (useCurrentUser), and the nav gates off it the same way for is_admin.
  const ai = await aiAvailability();

  return NextResponse.json({
    id: u.id,
    email: u.email,
    name: u.name,
    preferences: u.preferences ?? {},
    strava_connected: u.stravaAccessToken != null,
    is_admin: isAdmin(u),
    ai_enabled: ai.available,
    ai_disabled_notice: ai.notice,
    profile_summary: u.profileSummary,
    coach_instructions: u.coachInstructions,
    athlete_profile: u.athleteProfile,
    created_at: u.createdAt.toISOString(),
  });
}
