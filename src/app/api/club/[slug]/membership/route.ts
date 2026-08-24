import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMemberships } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { countCoaches } from "@/server/services/club-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    visibility: z.enum(["typ_only", "full"]).optional(),
    user_id: z.number().int().positive().optional(),
    role: z.enum(["coach", "athlete", "captain"]).optional(),
  })
  .refine((v) => v.visibility !== undefined || v.role !== undefined, {
    message: "Nothing to update",
  });

/**
 * PATCH /api/club/[slug]/membership
 * - `visibility` updates the caller's own membership.
 * - `role` (+ `user_id`) is coach-only and targets another member — a coach
 *   cannot change their own role (lockout protection).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { visibility, role, user_id } = parsed.data;

  if (visibility !== undefined) {
    await db
      .update(clubMemberships)
      .set({ visibility })
      .where(eq(clubMemberships.id, ctx.membership.id));
  }

  if (role !== undefined) {
    if (ctx.membership.role !== "coach") {
      return errorJson("Only coaches may change roles", 403);
    }
    if (!user_id) return errorJson("user_id is required to change a role", 422);
    if (user_id === ctx.user.id) {
      return errorJson("Coaches cannot change their own role", 422);
    }
    const updated = await db
      .update(clubMemberships)
      .set({ role })
      .where(and(eq(clubMemberships.clubId, ctx.club.id), eq(clubMemberships.userId, user_id)))
      .returning();
    if (!updated.length) return errorJson("Member not found in this club", 404);
  }

  const [fresh] = await db
    .select()
    .from(clubMemberships)
    .where(eq(clubMemberships.id, ctx.membership.id))
    .limit(1);

  return NextResponse.json({
    role: fresh.role,
    visibility: fresh.visibility,
  });
}

/**
 * DELETE /api/club/[slug]/membership — leave the club.
 *
 * The last coach is refused: without one, nobody could hand out the join code
 * or manage roles, and the club would be stranded.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  if (ctx.membership.role === "coach" && (await countCoaches(ctx.club.id)) <= 1) {
    return errorJson("Make someone else a coach before you leave", 422);
  }

  await db.delete(clubMemberships).where(eq(clubMemberships.id, ctx.membership.id));
  return new NextResponse(null, { status: 204 });
}
