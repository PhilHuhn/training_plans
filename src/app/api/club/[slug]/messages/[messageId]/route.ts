import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMessages } from "@/server/db/schema";
import { errorJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/club/[slug]/messages/[messageId]
 *
 * Your own message, or any message if you coach the club.
 *
 * The delete is scoped by clubId as well as message id, so a member of club A
 * cannot delete a message in club B by guessing its id — membership is proved
 * for one club only, and the row must belong to that same club.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; messageId: string }> },
) {
  const { slug, messageId } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  // The upper bound is not pedantry: `id` is a Postgres `integer`, and a value
  // past int4 passes Number.isInteger only to be rejected by the driver — a 500
  // where the caller deserves a 422.
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
    return errorJson("Invalid message id", 422);
  }

  const rows = await db
    .select({ id: clubMessages.id, userId: clubMessages.userId })
    .from(clubMessages)
    .where(and(eq(clubMessages.id, id), eq(clubMessages.clubId, ctx.club.id)))
    .limit(1);

  const message = rows[0];
  if (!message) return errorJson("Message not found", 404);

  const isAuthor = message.userId === ctx.user.id;
  const isCoach = ctx.membership.role === "coach";
  if (!isAuthor && !isCoach) {
    return errorJson("You can only delete your own messages", 403);
  }

  // Scoped by club as well as id, matching the SELECT above. The lookup
  // already makes cross-club deletion impossible, so this is belt and braces —
  // but it is the statement that actually removes the row, and it costs
  // nothing to make it carry the same guarantee the docblock promises.
  await db
    .delete(clubMessages)
    .where(and(eq(clubMessages.id, id), eq(clubMessages.clubId, ctx.club.id)));

  return new NextResponse(null, { status: 204 });
}
