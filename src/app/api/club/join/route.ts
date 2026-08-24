import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeJoinCode } from "@/lib/club-codes";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { clubMemberships } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { clubSummary, findClubByJoinCode, isMemberOf } from "@/server/services/club-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const joinSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

/**
 * POST /api/club/join — join a club with the code its coach handed out.
 *
 * Deliberately not gated by requireClubMember: this is the only route that can
 * create a user's first membership row, so it must be reachable by non-members.
 * New members land on the schema defaults (athlete / typ_only) — joining a club
 * never widens what teammates can see of your training.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, joinSchema);
  if ("response" in parsed) return parsed.response;

  const code = normalizeJoinCode(parsed.data.code);
  const club = await findClubByJoinCode(code);
  if (!club) return errorJson("No club found for that code", 404);

  if (await isMemberOf(club.id, session.user.id)) {
    return errorJson("You're already in this club", 400);
  }

  try {
    const [membership] = await db
      .insert(clubMemberships)
      .values({ clubId: club.id, userId: session.user.id })
      .returning();

    return NextResponse.json(clubSummary(club, membership.role, membership.visibility), {
      status: 201,
    });
  } catch (err) {
    console.error("[api] club join POST", err);
    return errorJson("Failed to join club", 500);
  }
}
