import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMessages, users } from "@/server/db/schema";
import { parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How much of the conversation the chat window holds.
 *
 * The window is the *newest* this many messages, and every poll returns the
 * whole window rather than a delta. That costs a few kilobytes per poll and
 * buys the only property that matters here: what the client holds is what the
 * server has.
 *
 * The first version fetched incrementally with an `after=<id>` cursor. It was
 * cheaper and wrong in three separate ways — a cursor that only ever moves
 * forward never re-reads a row, so a message deleted by someone else stayed on
 * every other member's screen until they reloaded; a poll already in flight
 * when a mutation wrote to the cache would resolve and overwrite it with its
 * own pre-mutation snapshot; and because refetching could never disagree with
 * the cache, there was no way back to server truth once they diverged.
 */
const WINDOW_SIZE = 60;

const postSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

/**
 * GET /api/club/[slug]/messages
 *
 * The newest WINDOW_SIZE messages, oldest first so the client can render them
 * top to bottom without reordering.
 *
 * Selected in descending id and reversed: ordering ascending with a LIMIT would
 * return the *oldest* rows, which is what this route did before — a club with
 * months of history showed its first ever messages and crept forward one page
 * per poll.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

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
    .where(eq(clubMessages.clubId, ctx.club.id))
    .orderBy(desc(clubMessages.id))
    .limit(WINDOW_SIZE);

  const isCoach = ctx.membership.role === "coach";

  return NextResponse.json({
    // Reversed here, not in the query, so the LIMIT applies to the newest end.
    messages: rows.reverse().map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.createdAt.toISOString(),
      author_id: r.userId,
      author_name: r.authorName,
      // Resolved server-side: the client should not have to know the rules to
      // decide whether to offer a delete button. DELETE re-checks it rather
      // than trusting this flag.
      can_delete: r.userId === ctx.user.id || isCoach,
    })),
    // Lets the client say so rather than silently truncating the history.
    window_size: WINDOW_SIZE,
    truncated: rows.length === WINDOW_SIZE,
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
