import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { trainingSessions } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { trainingSessionResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SessionStatus = z.enum(["planned", "completed", "skipped", "modified"]);
const Workout = z.record(z.string(), z.unknown());

const UpdateBody = z.object({
  planned_workout: Workout.nullable().optional(),
  recommendation_workout: Workout.nullable().optional(),
  status: SessionStatus.optional(),
  notes: z.string().nullable().optional(),
  rpe_actual: z.number().int().min(1).max(10).nullable().optional(),
});

async function loadSession(id: number, userId: number) {
  const rows = await db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.id, id), eq(trainingSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const existing = await loadSession(Number(id), session.user.id);
  if (!existing) return errorJson("Training session not found", 404);

  const parsed = await parseJson(req, UpdateBody);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.planned_workout !== undefined) update.plannedWorkout = data.planned_workout;
  if (data.recommendation_workout !== undefined) update.recommendationWorkout = data.recommendation_workout;
  if (data.status !== undefined) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.rpe_actual !== undefined) update.rpeActual = data.rpe_actual;

  const [updated] = await db
    .update(trainingSessions)
    .set(update)
    .where(and(eq(trainingSessions.id, Number(id)), eq(trainingSessions.userId, session.user.id)))
    .returning();

  return NextResponse.json(trainingSessionResponse(updated));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const existing = await loadSession(Number(id), session.user.id);
  if (!existing) return errorJson("Training session not found", 404);

  await db
    .delete(trainingSessions)
    .where(and(eq(trainingSessions.id, Number(id)), eq(trainingSessions.userId, session.user.id)));

  return new NextResponse(null, { status: 204 });
}
