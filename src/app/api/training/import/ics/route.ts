import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { trainingSessions, type NewTrainingSession } from "@/server/db/schema";
import { errorJson } from "@/server/http";
import { parseIcsToSessions } from "@/server/services/ics-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/training/import/ics — multipart upload of a calendar file.
 * Creates planned sessions (source "ics_import"). Dedupes on
 * (userId, sessionDate, type) so re-importing the same file is idempotent.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorJson("Expected multipart/form-data with a file field", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorJson("Missing 'file' field in form data", 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return errorJson("File too large. Maximum size is 5MB.", 400);
  }

  const text = await file.text();
  let parsed: ReturnType<typeof parseIcsToSessions>;
  try {
    parsed = parseIcsToSessions(text);
  } catch (err) {
    console.error("[import/ics] parse error:", err);
    return errorJson("Could not parse calendar file", 400);
  }

  if (parsed.sessions.length === 0) {
    return NextResponse.json({ imported: 0, skipped: parsed.skipped, duplicates: 0 });
  }

  // Load existing sessions in the imported date range for dedupe.
  const dates = [...new Set(parsed.sessions.map((s) => s.sessionDate))];
  const existing = await db
    .select({ sessionDate: trainingSessions.sessionDate, plannedWorkout: trainingSessions.plannedWorkout })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, session.user.id), inArray(trainingSessions.sessionDate, dates)));

  const existingKeys = new Set(
    existing.map(
      (e) => `${e.sessionDate}|${(e.plannedWorkout as { type?: string } | null)?.type ?? ""}`,
    ),
  );

  const toInsert: NewTrainingSession[] = [];
  let duplicates = 0;
  for (const s of parsed.sessions) {
    const key = `${s.sessionDate}|${s.workout.type}`;
    if (existingKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    existingKeys.add(key);
    toInsert.push({
      userId: session.user.id,
      sessionDate: s.sessionDate,
      source: "ics_import",
      status: "planned",
      plannedWorkout: s.workout,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(trainingSessions).values(toInsert);
  }

  return NextResponse.json({
    imported: toInsert.length,
    duplicates,
    skipped: parsed.skipped,
  });
}
