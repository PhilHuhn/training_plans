import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { feedback } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { feedbackResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(["open", "planned", "in_progress", "done", "declined"]).optional(),
    // Written for the submitter — they see it verbatim next to their report.
    admin_note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.admin_note !== undefined, {
    message: "Nothing to update",
  });

/** PATCH /api/admin/feedback/[id] — set the status and reply to the submitter. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const feedbackId = Number(id);
  if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
    return errorJson("Invalid feedback id", 422);
  }

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { status, admin_note } = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) update.status = status;
  if (admin_note !== undefined) update.adminNote = admin_note?.trim() || null;

  const updated = await db
    .update(feedback)
    .set(update)
    .where(eq(feedback.id, feedbackId))
    .returning();

  if (!updated.length) return errorJson("Feedback not found", 404);
  return NextResponse.json(feedbackResponse(updated[0]));
}

/** DELETE /api/admin/feedback/[id] — remove a submission (spam, duplicates). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const feedbackId = Number(id);
  if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
    return errorJson("Invalid feedback id", 422);
  }

  const removed = await db
    .delete(feedback)
    .where(eq(feedback.id, feedbackId))
    .returning({ id: feedback.id });

  if (!removed.length) return errorJson("Feedback not found", 404);
  return new NextResponse(null, { status: 204 });
}
