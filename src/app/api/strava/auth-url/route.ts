import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { STRAVA_AUTH_URL, STRAVA_REDIRECT_URI } from "@/server/services/strava";

import { DEFAULT_RETURN_KEY, RETURN_TO } from "@/server/services/strava-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Where to land after the round trip. A key from a fixed map, never a caller
  // supplied path: `state` travels through Strava and back, so accepting a raw
  // path here would make this an open redirect.
  const requested = req.nextUrl.searchParams.get("return_to") ?? "";
  const returnKey = requested in RETURN_TO ? requested : DEFAULT_RETURN_KEY;

  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: "code",
    scope: "read,activity:read_all",
    state: `${session.user.id}:${returnKey}`,
  });
  return NextResponse.json({ auth_url: `${STRAVA_AUTH_URL}?${params.toString()}` });
}
