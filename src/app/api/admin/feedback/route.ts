import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import type { AdminFeedbackWire } from "@/lib/types";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { feedback, users } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/feedback — every submission, joined to its submitter. */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const rows = await db
    .select({
      id: feedback.id,
      category: feedback.category,
      title: feedback.title,
      body: feedback.body,
      status: feedback.status,
      adminNote: feedback.adminNote,
      pageUrl: feedback.pageUrl,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(feedback)
    .innerJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt));

  const body: AdminFeedbackWire[] = rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    body: r.body,
    status: r.status,
    admin_note: r.adminNote,
    page_url: r.pageUrl,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    user_id: r.userId,
    user_name: r.userName,
    user_email: r.userEmail,
  }));

  return NextResponse.json({ feedback: body });
}
