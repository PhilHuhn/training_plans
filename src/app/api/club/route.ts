import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import type { ClubSummary } from "@/lib/types";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { clubMemberships, clubs } from "@/server/db/schema";

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
