import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { competitions } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { competitionResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RaceType = z.enum(["5K", "10K", "HM", "M", "50K", "100K", "50M", "100M", "OTHER"]);
const RacePriority = z.enum(["A", "B", "C"]);

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  race_type: RaceType.optional(),
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  distance: z.number().nullable().optional(),
  elevation_gain: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  goal_time: z.number().int().nullable().optional(),
  goal_pace: z.number().nullable().optional(),
  priority: RacePriority.optional(),
  notes: z.string().nullable().optional(),
});

async function loadCompetition(id: number, userId: number) {
  const rows = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.id, id), eq(competitions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;
  const { id } = await params;
  const competition = await loadCompetition(Number(id), session.user.id);
  if (!competition) return errorJson("Competition not found", 404);
  return NextResponse.json(competitionResponse(competition));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const existing = await loadCompetition(Number(id), session.user.id);
  if (!existing) return errorJson("Competition not found", 404);

  const parsed = await parseJson(req, UpdateBody);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name;
  if (data.race_type !== undefined) update.raceType = data.race_type;
  if (data.race_date !== undefined) update.raceDate = data.race_date;
  if (data.distance !== undefined) update.distance = data.distance;
  if (data.elevation_gain !== undefined) update.elevationGain = data.elevation_gain;
  if (data.location !== undefined) update.location = data.location;
  if (data.goal_time !== undefined) update.goalTime = data.goal_time;
  if (data.goal_pace !== undefined) update.goalPace = data.goal_pace;
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.notes !== undefined) update.notes = data.notes;

  const [updated] = await db
    .update(competitions)
    .set(update)
    .where(and(eq(competitions.id, Number(id)), eq(competitions.userId, session.user.id)))
    .returning();
  return NextResponse.json(competitionResponse(updated));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { id } = await params;
  const existing = await loadCompetition(Number(id), session.user.id);
  if (!existing) return errorJson("Competition not found", 404);

  await db
    .delete(competitions)
    .where(and(eq(competitions.id, Number(id)), eq(competitions.userId, session.user.id)));
  return new NextResponse(null, { status: 204 });
}
