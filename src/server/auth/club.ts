import "server-only";
import { and, eq } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  clubs,
  clubMemberships,
  type Club,
  type ClubMembership,
  type ClubRole,
  type User,
} from "@/server/db/schema";
import { errorJson } from "@/server/http";
import { requireSession } from "./session";

export type ClubContext = {
  user: User;
  club: Club;
  membership: ClubMembership;
};

/**
 * Like requireSession, but additionally resolves the club by slug and the
 * caller's membership in it. 404 if the club doesn't exist, 403 if the
 * caller is not a member. Every club-scoped route starts with this — the
 * membership row is the tenancy boundary.
 */
export async function requireClubMember(
  req: NextRequest | Request,
  slug: string,
): Promise<ClubContext | { response: NextResponse }> {
  const session = await requireSession(req);
  if ("response" in session) return session;

  const clubRows = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
  const club = clubRows[0];
  if (!club) return { response: errorJson("Club not found", 404) };

  const memberRows = await db
    .select()
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, club.id), eq(clubMemberships.userId, session.user.id)))
    .limit(1);
  const membership = memberRows[0];
  if (!membership) return { response: errorJson("Not a member of this club", 403) };

  return { user: session.user, club, membership };
}

/** requireClubMember + role check (403 when the member's role is not allowed). */
export async function requireClubRole(
  req: NextRequest | Request,
  slug: string,
  roles: ClubRole[],
): Promise<ClubContext | { response: NextResponse }> {
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx;
  if (!roles.includes(ctx.membership.role)) {
    return { response: errorJson("Insufficient club role", 403) };
  }
  return ctx;
}
