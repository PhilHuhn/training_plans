import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
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

const CreateBody = z.object({
  name: z.string().min(1),
  race_type: RaceType,
  race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distance: z.number().nullable().optional(),
  elevation_gain: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  goal_time: z.number().int().nullable().optional(),
  goal_pace: z.number().nullable().optional(),
  priority: RacePriority.optional().default("B"),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const includePast = req.nextUrl.searchParams.get("include_past") === "true";
  const today = new Date().toISOString().slice(0, 10);

  const where = includePast
    ? eq(competitions.userId, session.user.id)
    : and(eq(competitions.userId, session.user.id), gte(competitions.raceDate, today));

  const rows = await db.select().from(competitions).where(where).orderBy(asc(competitions.raceDate));
  return NextResponse.json(rows.map(competitionResponse));
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, CreateBody);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  try {
    const [created] = await db
      .insert(competitions)
      .values({
        userId: session.user.id,
        name: data.name,
        raceType: data.race_type,
        raceDate: data.race_date,
        distance: data.distance ?? null,
        elevationGain: data.elevation_gain ?? null,
        location: data.location ?? null,
        goalTime: data.goal_time ?? null,
        goalPace: data.goal_pace ?? null,
        priority: data.priority ?? "B",
        notes: data.notes ?? null,
      })
      .returning();
    return NextResponse.json(competitionResponse(created), { status: 201 });
  } catch (err) {
    console.error("[api] competitions POST", err);
    return errorJson("Failed to create competition", 500);
  }
}
