import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { feedback } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { feedbackResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Category = z.enum(["bug", "feature", "question", "other"]);

const CreateBody = z.object({
  category: Category,
  title: z.string().trim().min(3, "Give it a short title").max(200),
  body: z.string().trim().min(5, "Tell us a little more").max(5000),
  // Captured from the client so a bug report says where it happened. Stored as
  // a path, never a full URL, so nothing from the query string is retained.
  page_url: z.string().trim().max(200).nullable().optional(),
});

/** GET /api/feedback — the caller's own submissions, newest first. */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Ownership is in the WHERE, never a post-filter.
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, session.user.id))
    .orderBy(desc(feedback.createdAt));

  return NextResponse.json(rows.map(feedbackResponse));
}

/** POST /api/feedback — file a bug report or a feature request. */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, CreateBody);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  try {
    const [created] = await db
      .insert(feedback)
      .values({
        userId: session.user.id,
        category: data.category,
        title: data.title,
        body: data.body,
        pageUrl: data.page_url?.trim() || null,
      })
      .returning();
    return NextResponse.json(feedbackResponse(created), { status: 201 });
  } catch (err) {
    console.error("[api] feedback POST", err);
    return errorJson("Failed to send your feedback", 500);
  }
}
