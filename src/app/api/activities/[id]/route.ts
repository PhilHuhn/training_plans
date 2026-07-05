import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { activities } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { activityResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, Number(id)), eq(activities.userId, session.user.id)))
    .limit(1);
  if (!rows[0]) return errorJson("Activity not found", 404);
  return NextResponse.json(activityResponse(rows[0]));
}
