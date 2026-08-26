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

  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return errorJson("Invalid message id", 422);

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

  await db.delete(clubMessages).where(eq(clubMessages.id, id));

  return new NextResponse(null, { status: 204 });
}
