import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { trainingSessions } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { trainingSessionResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SessionSource = z.enum(["app_recommendation", "uploaded_plan", "manual"]);

// Loose schemas for the JSON workout shape — wire format mirrors Pydantic
// `WorkoutDetails`. We pass it through as-is on insert/update.
const Workout = z.record(z.string(), z.unknown());

const CreateBody = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: SessionSource.optional().default("manual"),
  planned_workout: Workout.nullable().optional(),
  recommendation_workout: Workout.nullable().optional(),
  notes: z.string().nullable().optional(),
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") ?? todayISO();
  const endDate = sp.get("end_date") ?? addDaysISO(startDate, 14);

  const rows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        gte(trainingSessions.sessionDate, startDate),
        lte(trainingSessions.sessionDate, endDate),
      ),
    )
    .orderBy(asc(trainingSessions.sessionDate));

  return NextResponse.json(rows.map(trainingSessionResponse));
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, CreateBody);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const existing = await db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, session.user.id),
        eq(trainingSessions.sessionDate, data.session_date),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return errorJson("Session already exists for this date. Use PUT to update.", 400);
  }

  const [created] = await db
    .insert(trainingSessions)
    .values({
      userId: session.user.id,
      sessionDate: data.session_date,
      source: data.source,
      plannedWorkout: data.planned_workout ?? null,
      recommendationWorkout: data.recommendation_workout ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  return NextResponse.json(trainingSessionResponse(created), { status: 201 });
}
