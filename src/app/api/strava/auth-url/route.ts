import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { STRAVA_AUTH_URL, STRAVA_REDIRECT_URI } from "@/server/services/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: "code",
    scope: "read,activity:read_all",
    state: String(session.user.id),
  });
  return NextResponse.json({ auth_url: `${STRAVA_AUTH_URL}?${params.toString()}` });
}
