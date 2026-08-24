import { asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { parseAdminEmails } from "@/lib/admin";
import type { AdminUserWire } from "@/lib/types";
import { isAdmin, requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { clubMemberships, clubs, users } from "@/server/db/schema";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = parseAdminEmails(env.ADMIN_EMAILS);

/** GET /api/admin/users — every registered user with their club memberships. */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const userRows = await db.select().from(users).orderBy(asc(users.id));

  const membershipRows = await db
    .select({
      userId: clubMemberships.userId,
      clubId: clubs.id,
      clubName: clubs.name,
      slug: clubs.slug,
      role: clubMemberships.role,
      visibility: clubMemberships.visibility,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
    .orderBy(asc(clubs.name));

  const byUser = new Map<number, AdminUserWire["memberships"]>();
  for (const m of membershipRows) {
    const list = byUser.get(m.userId) ?? [];
    list.push({
      club_id: m.clubId,
      club_name: m.clubName,
      slug: m.slug,
      role: m.role,
      visibility: m.visibility,
    });
    byUser.set(m.userId, list);
  }

  const body: AdminUserWire[] = userRows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    created_at: u.createdAt.toISOString(),
    strava_connected: u.stravaAccessToken != null,
    is_admin: isAdmin(u),
    admin_via_env: ADMIN_EMAILS.has(u.email.trim().toLowerCase()),
    memberships: byUser.get(u.id) ?? [],
  }));

  return NextResponse.json({ users: body });
}
