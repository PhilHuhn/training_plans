import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { trainingSessions, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { buildFitWorkout, type WorkoutDetailsLike } from "@/server/services/fit-export";

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

  const workoutData = (ts.finalWorkout ?? ts.plannedWorkout ?? ts.recommendationWorkout) as WorkoutDetailsLike | null;
  if (!workoutData) return errorJson("No workout data available for export", 400);

  const prefs = (session.user.preferences ?? {}) as UserPreferences;

  try {
    const dt = new Date(`${ts.sessionDate}T00:00:00Z`);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const workoutType = workoutData.type ?? "workout";
    const titled = workoutType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const workoutName = `${mm}/${dd} ${titled}`.slice(0, 20);

    const fit = buildFitWorkout(
      workoutData,
      { max_hr: prefs.max_hr, resting_hr: prefs.resting_hr, hr_zones: prefs.hr_zones },
      workoutName,
    );

    const dateStr = (ts.sessionDate as unknown as string).replace(/-/g, "");
    const filename = `${dateStr}_${workoutType.replace(/_/g, "-")}.fit`;

    return new NextResponse(new Uint8Array(fit), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(fit.length),
      },
    });
  } catch (err) {
    console.error("[export/garmin] error:", err);
    return errorJson(err instanceof Error ? err.message : "Failed to create FIT file", 500);
  }
}
