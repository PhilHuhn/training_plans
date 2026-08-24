import { asc, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import type { AdminClubWire } from "@/lib/types";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { clubMemberships, clubs } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/clubs — every club with its member count and join code. */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      planTier: clubs.planTier,
      donationUrl: clubs.donationUrl,
      joinCode: clubs.joinCode,
      createdAt: clubs.createdAt,
      memberCount: sql<number>`count(${clubMemberships.id})::int`,
    })
    .from(clubs)
    .leftJoin(clubMemberships, eq(clubMemberships.clubId, clubs.id))
    .groupBy(clubs.id)
    .orderBy(asc(clubs.name));

  const body: AdminClubWire[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    plan_tier: c.planTier,
    donation_url: c.donationUrl,
    join_code: c.joinCode,
    member_count: c.memberCount,
    created_at: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ clubs: body });
}
