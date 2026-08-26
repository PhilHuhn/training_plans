import { and, asc, eq, gt } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMessages, users } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How many messages a cold load returns. The client polls with `after`, so this
 * ceiling only bounds the first paint, not the conversation.
 */
const PAGE_SIZE = 100;

const postSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

/**
 * GET /api/club/[slug]/messages?after=<id>
 *
 * Oldest first, so the client can append rather than reorder.
 *
 * `after` is what makes polling cheap: the client sends the newest id it holds
 * and gets only what arrived since. Without it every poll would re-send the
 * whole conversation every few seconds.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw ? Number(afterRaw) : null;
  if (afterRaw && (!Number.isInteger(after) || after! < 0)) {
    return errorJson("Invalid 'after' cursor", 422);
  }

  const where = after
    ? and(eq(clubMessages.clubId, ctx.club.id), gt(clubMessages.id, after))
    : eq(clubMessages.clubId, ctx.club.id);

  const rows = await db
    .select({
      id: clubMessages.id,
      body: clubMessages.body,
      createdAt: clubMessages.createdAt,
      userId: clubMessages.userId,
      authorName: users.name,
    })
    .from(clubMessages)
    .innerJoin(users, eq(clubMessages.userId, users.id))
    .where(where)
    .orderBy(asc(clubMessages.id))
    .limit(PAGE_SIZE);

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.createdAt.toISOString(),
      author_id: r.userId,
      author_name: r.authorName,
      // Resolved server-side: the client should not have to know the rules to
      // decide whether to offer a delete button.
      can_delete: r.userId === ctx.user.id || ctx.membership.role === "coach",
    })),
  });
}

/** POST /api/club/[slug]/messages — post to the club the caller is a member of. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  const parsed = await parseJson(req, postSchema);
  if ("response" in parsed) return parsed.response;

  const [row] = await db
    .insert(clubMessages)
    .values({
      // From the gate, never from the request body — the club is whichever one
      // the caller proved membership of.
      clubId: ctx.club.id,
      userId: ctx.user.id,
      body: parsed.data.body,
    })
    .returning();

  return NextResponse.json(
    {
      id: row.id,
      body: row.body,
      created_at: row.createdAt.toISOString(),
      author_id: ctx.user.id,
      author_name: ctx.user.name,
      can_delete: true,
    },
    { status: 201 },
  );
}
