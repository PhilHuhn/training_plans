import { eq, ne, and } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ is_admin: z.boolean() });

/**
 * PATCH /api/admin/users/[id] — grant or revoke platform admin.
 *
 * Two lockout guards: an admin cannot demote themselves, and the last remaining
 * flagged admin cannot be demoted. ADMIN_EMAILS is unaffected either way — it is
 * env-held, so it always survives as the way back in.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return errorJson("Invalid user id", 422);

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { is_admin } = parsed.data;

  if (userId === gate.user.id && !is_admin) {
    return errorJson("You cannot remove your own admin access", 422);
  }

  if (!is_admin) {
    const others = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isAdmin, true), ne(users.id, userId)))
      .limit(1);
    if (others.length === 0) {
      return errorJson("At least one admin must remain", 422);
    }
  }

  const updated = await db
    .update(users)
    .set({ isAdmin: is_admin, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, isAdmin: users.isAdmin });

  if (!updated.length) return errorJson("User not found", 404);
  return NextResponse.json({ id: updated[0].id, is_admin: updated[0].isAdmin });
}
