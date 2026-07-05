import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { uploadedPlans } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const rows = await db
    .select({ id: uploadedPlans.id })
    .from(uploadedPlans)
    .where(and(eq(uploadedPlans.id, Number(id)), eq(uploadedPlans.userId, session.user.id)))
    .limit(1);
  if (!rows[0]) return errorJson("Uploaded plan not found", 404);

  // ON DELETE SET NULL on training_sessions.uploaded_plan_id handles linkage
  await db
    .delete(uploadedPlans)
    .where(and(eq(uploadedPlans.id, Number(id)), eq(uploadedPlans.userId, session.user.id)));

  return new NextResponse(null, { status: 204 });
}
