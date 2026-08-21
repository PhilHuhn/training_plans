import { and, eq, gte, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { trainingSessions } from "@/server/db/schema";
import { errorJson } from "@/server/http";
import { buildIcsForSessions, type IcsSession } from "@/server/services/ics-export";
import { resolveEffectiveWorkout } from "@/server/services/workout-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/training/export/ics?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Exports the caller's OWN planned sessions in the range as an .ics file.
 * Own-data only in v1 — a coach club export is a v2 visibility concern.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if ((start && !DATE_RE.test(start)) || (end && !DATE_RE.test(end))) {
    return errorJson("Invalid start/end (expected YYYY-MM-DD)", 422);
  }

  const conditions = [eq(trainingSessions.userId, session.user.id)];
  if (start) conditions.push(gte(trainingSessions.sessionDate, start));
  if (end) conditions.push(lte(trainingSessions.sessionDate, end));

  const rows = await db
    .select()
    .from(trainingSessions)
    .where(and(...conditions))
    .orderBy(trainingSessions.sessionDate);

  const sessions: IcsSession[] = rows.map((r) => ({
    id: r.id,
    sessionDate: r.sessionDate,
    workout: resolveEffectiveWorkout(r),
  }));

  const ics = buildIcsForSessions(sessions, `Training – ${session.user.name}`);
  const filename = `training_${start ?? "all"}_${end ?? "all"}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
