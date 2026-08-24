import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { clubMemberships, clubs, users } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE = z.enum(["coach", "athlete", "captain"]);
const VISIBILITY = z.enum(["typ_only", "full"]);

const target = { club_id: z.number().int().positive(), user_id: z.number().int().positive() };

const createSchema = z.object({
  ...target,
  role: ROLE.optional(),
  visibility: VISIBILITY.optional(),
});

const patchSchema = z
  .object({ ...target, role: ROLE.optional(), visibility: VISIBILITY.optional() })
  .refine((v) => v.role !== undefined || v.visibility !== undefined, {
    message: "Nothing to update",
  });

const deleteSchema = z.object(target);

/** POST /api/admin/memberships — place a user into a club. */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const parsed = await parseJson(req, createSchema);
  if ("response" in parsed) return parsed.response;
  const { club_id, user_id, role, visibility } = parsed.data;

  const [club] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, club_id)).limit(1);
  if (!club) return errorJson("Club not found", 404);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, user_id)).limit(1);
  if (!user) return errorJson("User not found", 404);

  const existing = await db
    .select({ id: clubMemberships.id })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, club_id), eq(clubMemberships.userId, user_id)))
    .limit(1);
  if (existing.length) return errorJson("That user is already in this club", 400);

  const [created] = await db
    .insert(clubMemberships)
    .values({ clubId: club_id, userId: user_id, role, visibility })
    .returning();

  return NextResponse.json(
    { club_id, user_id, role: created.role, visibility: created.visibility },
    { status: 201 },
  );
}

/**
 * PATCH /api/admin/memberships — set a member's role and/or visibility.
 *
 * This intentionally bypasses the coach-only restrictions in
 * /api/club/[slug]/membership: a platform admin is the backstop when a club has
 * locked itself out. Note that changing `visibility` overrides a privacy choice
 * the athlete made about their own training data — use it to repair, not to snoop.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { club_id, user_id, role, visibility } = parsed.data;

  const update: Record<string, unknown> = {};
  if (role !== undefined) update.role = role;
  if (visibility !== undefined) update.visibility = visibility;

  const updated = await db
    .update(clubMemberships)
    .set(update)
    .where(and(eq(clubMemberships.clubId, club_id), eq(clubMemberships.userId, user_id)))
    .returning();

  if (!updated.length) return errorJson("Membership not found", 404);

  return NextResponse.json({
    club_id,
    user_id,
    role: updated[0].role,
    visibility: updated[0].visibility,
  });
}

/** DELETE /api/admin/memberships — remove a user from a club. */
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const parsed = await parseJson(req, deleteSchema);
  if ("response" in parsed) return parsed.response;
  const { club_id, user_id } = parsed.data;

  const removed = await db
    .delete(clubMemberships)
    .where(and(eq(clubMemberships.clubId, club_id), eq(clubMemberships.userId, user_id)))
    .returning({ id: clubMemberships.id });

  if (!removed.length) return errorJson("Membership not found", 404);
  return new NextResponse(null, { status: 204 });
}
