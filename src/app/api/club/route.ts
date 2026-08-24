import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ClubSummary } from "@/lib/types";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { clubMemberships, clubs } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { clubSummary, createClubForUser } from "@/server/services/club-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/club — the caller's club memberships. */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      planTier: clubs.planTier,
      role: clubMemberships.role,
      visibility: clubMemberships.visibility,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
    .where(eq(clubMemberships.userId, session.user.id))
    .orderBy(clubs.name);

  const memberships: ClubSummary[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    plan_tier: r.planTier,
    role: r.role,
    visibility: r.visibility,
  }));

  return NextResponse.json({ memberships });
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Club name must be at least 2 characters").max(255),
});

/**
 * POST /api/club — create a club. The creator becomes its coach, and the
 * response carries the join code so they can hand it to teammates right away.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, createSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const club = await createClubForUser(parsed.data.name, session.user.id);
    return NextResponse.json(
      { ...clubSummary(club, "coach", "full"), join_code: club.joinCode },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api] club POST", err);
    return errorJson("Failed to create club", 500);
  }
}
