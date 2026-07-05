import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { trainingSessions } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const source = req.nextUrl.searchParams.get("source");
  if (source !== "planned" && source !== "ai") {
    return errorJson("Invalid source. Use 'planned' or 'ai'", 400);
  }

  const { id } = await params;
  const rows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, Number(id)),
        eq(trainingSessions.userId, session.user.id),
      ),
    )
    .limit(1);
  const ts = rows[0];
  if (!ts) return errorJson("Training session not found", 404);

  let finalWorkout: unknown = null;
  if (source === "planned") {
    if (!ts.plannedWorkout) return errorJson("No planned workout to accept", 400);
    finalWorkout = ts.plannedWorkout;
  } else {
    if (!ts.recommendationWorkout) return errorJson("No AI recommendation to accept", 400);
    finalWorkout = ts.recommendationWorkout;
  }

  await db
    .update(trainingSessions)
    .set({
      finalWorkout,
      acceptedSource: source,
      updatedAt: new Date(),
    })
    .where(eq(trainingSessions.id, Number(id)));

  return NextResponse.json({ success: true, accepted_source: source });
}
