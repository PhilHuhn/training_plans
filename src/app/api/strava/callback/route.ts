import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";
import { STRAVA_TOKEN_URL } from "@/server/services/strava";
import { parseStravaState } from "@/server/services/strava-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  // Resolved first so that every outcome below — including the failures — sends
  // the user back where they started rather than dumping them in /settings.
  const { userId, returnPath } = parseStravaState(state);

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${returnPath}?strava=error&reason=invalid_query`, req.url),
      302,
    );
  }

  if (userId === null) {
    return NextResponse.redirect(
      new URL(`${returnPath}?strava=error&reason=invalid_state`, req.url),
      302,
    );
  }

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    return NextResponse.redirect(
      new URL(`${returnPath}?strava=error&reason=user_not_found`, req.url),
      302,
    );
  }

  const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      new URL(`${returnPath}?strava=error&reason=token_exchange_failed`, req.url),
      302,
    );
  }

  const data = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: { id: number };
  };

  await db
    .update(users)
    .set({
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaAthleteId: data.athlete.id,
      stravaTokenExpiresAt: new Date(data.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return NextResponse.redirect(new URL(`${returnPath}?strava=connected`, req.url), 302);
}
